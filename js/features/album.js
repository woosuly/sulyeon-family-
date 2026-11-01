        // ── 앨범 ──────────────────────────────────────────────────
        // 폴더 카드 (하위폴더는 상위 폴더 안에서만 표시)
        function albumFolderCard(f) {
            const subs = albumData.filter(x => x.parentId === f.id).length;
            return `<div class="banner" style="background:#fff; padding:15px;" onclick="openFolderDetail('${escHtml(f.id)}')">
                    <div style="font-size:30px;">📁</div>
                    <b>${escHtml(f.name)}</b>
                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${(f.photos||[]).length}장${subs ? ' · 폴더 ' + subs : ''}</div>
                </div>`;
        }
        function renderFolders() {
            const c = document.getElementById('folder-container');
            const ids = new Set(albumData.map(x => x.id));
            c.innerHTML = albumData.filter(f => !f.parentId || !ids.has(f.parentId)).map(albumFolderCard).join('');
            if (currentFolderId) renderSubFolders();
        }
        function renderSubFolders() {
            const el = document.getElementById('sub-folder-list'); if (!el) return;
            const subs = albumData.filter(x => x.parentId === currentFolderId);
            el.innerHTML = subs.length ? `<div class="folder-grid" style="margin-top:0">${subs.map(albumFolderCard).join('')}</div>` : '';
        }

        function openFolderDetail(id) {
            currentFolderId = id;
            if (photoSelectMode) { photoSelectMode = false; selectedPhotos.clear(); document.getElementById('photo-select-btn').textContent = '선택'; document.getElementById('photo-select-bar').style.display = 'none'; }
            document.getElementById('photo-main-view').classList.add('hidden');
            document.getElementById('photo-detail-view').classList.remove('hidden');
            history.pushState({ modal: 'folder-detail', folderId: id }, '', '');
            const f = albumData.find(x => x.id === id);
            if (f) {
                document.getElementById('detail-folder-title').innerText = f.name;
                renderGallery();
                renderSubFolders();
                // 예전 방식(문서 안 base64)으로 저장된 사진은 Storage로 옮김
                if ((f.photos || []).some(p => String(p).startsWith('data:'))) albumMigrate(id);
            }
        }

        // ── 앨범 사진 저장소 (Firebase Storage) ──
        // Firestore 문서 한도(1MB) 때문에 사진 본문은 Storage에, 문서에는 URL만 저장
        async function albumUploadDataUrl(dataUrl, folderId) {
            const blob = await (await fetch(dataUrl)).blob();
            const ref = storage.ref(`albums/${folderId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
            await ref.put(blob, { contentType: 'image/jpeg' });
            return await ref.getDownloadURL();
        }
        function albumDelFile(url) {
            if (/^https?:/.test(String(url || ''))) { try { storage.refFromURL(url).delete().catch(() => {}); } catch (e) {} }
        }
        const albumMigrating = {};
        async function albumMigrate(id) {
            if (albumMigrating[id]) return; albumMigrating[id] = 1;
            try {
                const f = albumData.find(x => x.id === id); if (!f) return;
                const map = new Map();
                for (const p of (f.photos || [])) {
                    if (String(p).startsWith('data:') && !map.has(p)) map.set(p, await albumUploadDataUrl(p, id));
                }
                if (!map.size) return;
                const ref = db.collection('albums').doc(id);
                await db.runTransaction(async t => {
                    const s = await t.get(ref); if (!s.exists) return;
                    t.update(ref, { photos: ((s.data() || {}).photos || []).map(p => map.get(p) || p) });
                });
            } catch (e) { console.warn('[앨범 이전]', e); }
            finally { delete albumMigrating[id]; }
        }

        function backToFolders() {
            currentFolderId = null;
            document.getElementById('photo-main-view').classList.remove('hidden');
            document.getElementById('photo-detail-view').classList.add('hidden');
        }

        function renderGallery() {
            const f = albumData.find(x => x.id === currentFolderId);
            const c = document.getElementById('gallery-container');
            if (f) {
                // 선택 모드: 탭하면 선택/해제, 일반 모드: 탭하면 크게 보기
                c.innerHTML = (f.photos || []).map((s, idx) => {
                    const on = photoSelectMode && selectedPhotos.has(idx);
                    return `<div class="gallery-item" data-idx="${idx}" style="${on ? 'outline:3px solid var(--month-header);outline-offset:-3px;' : ''}" onclick="albumTap(${idx})">
                        <img src="${escHtml(s)}" loading="lazy" style="${on ? 'opacity:.6' : ''}">
                        ${photoSelectMode
                            ? `<span style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:${on ? 'var(--month-header)' : 'rgba(0,0,0,.25)'};color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;">${on ? '✓' : ''}</span>`
                            : `<button class="photo-del-btn" onclick="event.stopPropagation(); deleteSinglePhoto(${idx})">✕</button>`}
                    </div>`;
                }).join('');
                const cnt = document.getElementById('photo-select-count');
                if (cnt) cnt.textContent = `${selectedPhotos.size}개 선택됨`;
            }
        }
        function albumTap(idx) {
            const f = albumData.find(x => x.id === currentFolderId); if (!f) return;
            if (!photoSelectMode) { openLightbox(f.photos[idx]); return; }
            if (selectedPhotos.has(idx)) selectedPhotos.delete(idx); else selectedPhotos.add(idx);
            renderGallery();
        }

        async function deleteSinglePhoto(idx) {
            if (!confirm("이 사진을 삭제할까요?")) return;
            const f = albumData.find(x => x.id === currentFolderId);
            if (f) {
                const url = f.photos[idx];
                f.photos.splice(idx, 1);
                await db.collection("albums").doc(currentFolderId).update({ photos: firebase.firestore.FieldValue.arrayRemove(url) });
                albumDelFile(url);
            }
        }

        // 사진은 Storage에 올리고 문서에는 URL만 추가 (arrayUnion: 두 사람이 동시에 올려도 덮어쓰지 않음)
        async function handleGalleryUpload(input) {
            if (!input.files || !currentFolderId) return;
            const folderId = currentFolderId;
            const files = Array.from(input.files);
            input.value = "";
            let ok = 0;
            for (const file of files) {
                try {
                    if (typeof famToast === 'function') famToast(`사진 올리는 중… (${ok + 1}/${files.length})`);
                    const base64 = await readFileAsBase64(file);
                    const compressed = await compressImage(base64, 1600, 0.82);
                    const url = await albumUploadDataUrl(compressed, folderId);
                    await db.collection("albums").doc(folderId).update({ photos: firebase.firestore.FieldValue.arrayUnion(url) });
                    ok++;
                } catch (e) {
                    console.warn('[앨범 업로드]', e);
                    alert('사진 업로드 실패: ' + (e.message || e.code || e) + '\nFirebase Storage 규칙에서 albums/ 경로 쓰기 권한을 확인하세요.');
                    break;
                }
            }
            if (ok && typeof famToast === 'function') famToast(`사진 ${ok}장을 올렸습니다`);
        }

        function readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.readAsDataURL(file);
                r.onload = (e) => resolve(e.target.result);
                r.onerror = reject;
            });
        }

        // openFolderModal(null) 새 폴더 · (id) 이름 수정 · (null, parentId) 하위폴더 추가
        function openFolderModal(editId, parentId) {
            resetModal();
            const edit = editId ? albumData.find(x => x.id === editId) : null;
            const parent = parentId ? albumData.find(x => x.id === parentId) : null;
            document.getElementById('folder-fields').classList.remove('hidden');
            document.getElementById('modal-title').innerText = edit ? "✏️ 폴더 이름 수정" : parent ? `📁 ${parent.name} 안에 폴더 만들기` : "📁 새 폴더 만들기";
            document.getElementById('btn-save').innerText = edit ? "저장" : "만들기";
            if (edit) document.getElementById('fold-name').value = edit.name || '';
            document.getElementById('btn-save').onclick = async () => {
                const name = document.getElementById('fold-name').value.trim();
                if (!name) return;
                if (edit) {
                    await db.collection("albums").doc(edit.id).update({ name });
                    if (currentFolderId === edit.id) document.getElementById('detail-folder-title').innerText = name;
                } else {
                    const id = "f_" + Date.now();
                    await db.collection("albums").doc(id).set(parent ? { id, name, photos: [], parentId: parent.id } : { id, name, photos: [] });
                }
                closeModal();
            };
            openModal();
        }

        async function deleteFolder() {
            const subs = albumData.filter(x => x.parentId === currentFolderId);
            if (confirm(subs.length ? `이 폴더와 사진을 모두 삭제할까요? 하위 폴더 ${subs.length}개는 상위 목록으로 옮겨집니다.` : "이 폴더와 사진을 모두 삭제할까요?")) {
                const f = albumData.find(x => x.id === currentFolderId);
                const batch = db.batch();
                subs.forEach(s => batch.update(db.collection("albums").doc(s.id), { parentId: firebase.firestore.FieldValue.delete() }));
                batch.delete(db.collection("albums").doc(currentFolderId));
                await batch.commit();
                ((f && f.photos) || []).forEach(albumDelFile);
                backToFolders();
            }
        }

