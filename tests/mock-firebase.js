// 시험용 가짜 Firebase (compat API 중 앱이 쓰는 부분만, 메모리에 저장)
//   window.__db: 저장된 문서 { 'col/id': data }  ·  window.__fbWrites: 쓰기 횟수
(function () {
    const store = {}; window.__db = store; window.__fbWrites = 0;
    const listeners = new Set();
    const SENT = '__fv';
    const ts = ms => ({ toDate: () => new Date(ms), toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 });
    const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (x && x.toMillis && x.seconds !== undefined) ? { __ts: x.toMillis() } : x), (k, x) => (x && x.__ts !== undefined) ? ts(x.__ts) : x);
    const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
    function applyFV(cur, key, v) {
        if (v && v[SENT]) {
            const t = v[SENT];
            if (t === 'ts') return ts(Date.now());
            if (t === 'del') return undefined;
            if (t === 'inc') return (+cur || 0) + v.n;
            if (t === 'union') return [...(Array.isArray(cur) ? cur : []), ...v.a.filter(x => !(cur || []).some(y => JSON.stringify(y) === JSON.stringify(x)))];
            if (t === 'remove') return (Array.isArray(cur) ? cur : []).filter(y => !v.a.some(x => JSON.stringify(x) === JSON.stringify(y)));
        }
        return v;
    }
    function merge(base, data, dotted) {
        const out = clone(base || {}) || {};
        for (const [k, v] of Object.entries(data || {})) {
            const path = dotted ? k.split('.') : [k]; let o = out;
            for (let i = 0; i < path.length - 1; i++) { if (typeof o[path[i]] !== 'object' || o[path[i]] === null) o[path[i]] = {}; o = o[path[i]]; }
            const last = path[path.length - 1], nv = applyFV(o[last], last, v);
            if (nv === undefined) delete o[last];
            else if (nv && typeof nv === 'object' && !Array.isArray(nv) && !nv[SENT] && !nv.toMillis && !dotted && o[last] && typeof o[last] === 'object') o[last] = nv;
            else o[last] = nv;
        }
        return out;
    }
    function cleanNew(data) { const o = merge({}, data, false); return o; }
    let notifyQ = false;
    function changed() { window.__fbWrites++; if (notifyQ) return; notifyQ = true; setTimeout(() => { notifyQ = false; listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }, 0); }

    class DocSnap { constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data; this.exists = data !== undefined; this.metadata = { hasPendingWrites: false, fromCache: false }; } data() { return clone(this._d); } get(f) { return getPath(this._d || {}, f); } }
    class DocRef {
        constructor(col, id) { this.col = col; this.id = id || ('auto' + Math.random().toString(36).slice(2, 12)); this.path = col + '/' + this.id; this.parent = { id: col }; }
        collection(c) { return new ColRef(this.path + '/' + c); }
        async get() { return new DocSnap(this, store[this.path]); }
        async set(d, o) { store[this.path] = o && o.merge ? merge(store[this.path], d, false) : cleanNew(d); changed(); }
        async update(d) { if (store[this.path] === undefined) { const e = new Error('No document to update'); e.code = 'not-found'; throw e; } store[this.path] = merge(store[this.path], d, true); changed(); }
        async delete() { delete store[this.path]; changed(); }
        onSnapshot(cb, err) { const f = () => cb(new DocSnap(this, store[this.path])); listeners.add(f); setTimeout(f, 0); return () => listeners.delete(f); }
    }
    class QuerySnap {
        constructor(docs, prev) { this.docs = docs; this.size = docs.length; this.empty = !docs.length; this._prev = prev || []; this.metadata = { hasPendingWrites: false, fromCache: false }; }
        forEach(f) { this.docs.forEach(f); }
        docChanges() { const pid = new Set(this._prev); return this.docs.filter(d => !pid.has(d.id)).map(d => ({ type: 'added', doc: d })); }
    }
    const cmp = (a, b) => { const v = x => x && x.toMillis ? x.toMillis() : x; a = v(a); b = v(b); return a < b ? -1 : a > b ? 1 : 0; };
    class Query {
        constructor(col, f, o, l, lr) { this.col = col; this._f = f || []; this._o = o || []; this._l = l; this._lr = lr; }
        where(field, op, val) { return new Query(this.col, [...this._f, [field, op, val]], this._o, this._l, this._lr); }
        orderBy(field, dir) { return new Query(this.col, this._f, [...this._o, [field, dir || 'asc']], this._l, this._lr); }
        limit(n) { return new Query(this.col, this._f, this._o, n, false); }
        limitToLast(n) { return new Query(this.col, this._f, this._o, n, true); }
        startAfter() { return this; }
        _run() {
            const pre = this.col + '/';
            let rows = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(k => ({ id: k.slice(pre.length), d: store[k] }));
            for (const [f, op, val] of this._f) rows = rows.filter(r => {
                const v = f === '__name__' ? r.id : getPath(r.d, f), c = cmp(v, val);
                return op === '==' ? c === 0 && v !== undefined : op === '!=' ? c !== 0 : op === '<' ? v !== undefined && c < 0 : op === '<=' ? v !== undefined && c <= 0 : op === '>' ? v !== undefined && c > 0 : op === '>=' ? v !== undefined && c >= 0
                    : op === 'in' ? val.some(x => cmp(v, x) === 0) : op === 'array-contains' ? Array.isArray(v) && v.some(x => cmp(x, val) === 0) : op === 'array-contains-any' ? Array.isArray(v) && v.some(x => val.includes(x)) : true;
            });
            for (const [f, dir] of [...this._o].reverse()) rows.sort((a, b) => cmp(getPath(a.d, f), getPath(b.d, f)) * (dir === 'desc' ? -1 : 1));
            if (this._l != null) rows = this._lr ? rows.slice(-this._l) : rows.slice(0, this._l);
            return rows.map(r => new DocSnap(new DocRef(this.col, r.id), r.d));
        }
        async get() { return new QuerySnap(this._run()); }
        onSnapshot(a, b) { const cb = typeof a === 'function' ? a : b; let prev = []; const f = () => { const d = this._run(); cb(new QuerySnap(d, prev)); prev = d.map(x => x.id); }; listeners.add(f); setTimeout(f, 0); return () => listeners.delete(f); }
    }
    class ColRef extends Query {
        constructor(path) { super(path); this.id = path.split('/').pop(); this.path = path; }
        doc(id) { return new DocRef(this.path, id); }
        async add(d) { const r = new DocRef(this.path); await r.set(d); return r; }
    }
    const fs = {
        collection: p => new ColRef(p), doc: p => { const i = p.lastIndexOf('/'); return new DocRef(p.slice(0, i), p.slice(i + 1)); },
        enablePersistence: async () => {}, settings() {},
        batch() { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: r => ops.push(() => r.delete()), commit: async () => { for (const f of ops) await f(); } }; },
        async runTransaction(fn) { return fn({ get: r => r.get(), set: (r, d, o) => { r.set(d, o); }, update: (r, d) => { r.update(d); }, delete: r => { r.delete(); } }); }
    };
    const FieldValue = { serverTimestamp: () => ({ [SENT]: 'ts' }), delete: () => ({ [SENT]: 'del' }), increment: n => ({ [SENT]: 'inc', n }), arrayUnion: (...a) => ({ [SENT]: 'union', a }), arrayRemove: (...a) => ({ [SENT]: 'remove', a }) };
    const user = { uid: 'test-uid', email: 'test@example.com', displayName: '정우설', getIdToken: async () => 'tok' };
    const auth = { currentUser: user, onAuthStateChanged(cb) { setTimeout(() => cb(user), 0); return () => {}; }, getRedirectResult: async () => ({}), signOut: async () => {}, signInWithPopup: async () => ({ user }), signInWithRedirect: async () => {}, signInWithCredential: async () => ({ user }), setPersistence: async () => {} };
    const authFn = () => auth; authFn.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; this.addScope = () => {}; }; authFn.GoogleAuthProvider.credential = () => ({}); authFn.Auth = { Persistence: { LOCAL: 'local' } };
    const fsFn = () => fs; fsFn.FieldValue = FieldValue; fsFn.Timestamp = { now: () => ts(Date.now()), fromMillis: ts, fromDate: d => ts(+d) };
    const sref = { child: () => sref, put: async () => ({ ref: sref }), putString: async () => ({ ref: sref }), getDownloadURL: async () => 'data:image/png;base64,', delete: async () => {} };
    const msgFn = () => ({ getToken: async () => '', onMessage() {}, deleteToken: async () => {} }); msgFn.isSupported = async () => false;
    window.firebase = { initializeApp: () => ({}), app: () => ({ options: {} }), apps: [{}], auth: authFn, firestore: fsFn, storage: () => ({ ref: () => sref, refFromURL: () => sref }), messaging: msgFn };
})();
