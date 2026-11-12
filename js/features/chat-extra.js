        // ══════════════════════════════════════════════════════
        // 🏞 채팅 배경: 풍경사진 + 날씨효과 + 투명도
        // ══════════════════════════════════════════════════════
        // Unsplash 무료 저작권 없는 사진 (각 사진 고유 ID)

        // 채팅 배경 적용 후 모달 닫기

        // 채팅 배경 전체 초기화

        // 미디어 패널 토글

        function switchChatBgTab(btn) {
            document.querySelectorAll('.chat-bg-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.querySelectorAll('.chat-bg-panel').forEach(p => p.style.display = 'none');
            const panel = document.getElementById('chatbgtab-'+tab);
            if (panel) panel.style.display = 'block';
        }

        // ══ 날씨 효과 Canvas 애니메이션 ══
        let chatFxType = localStorage.getItem('chatFxType') || 'none';
        let chatFxAnim = null;

        function setChatFx(type) {
            chatFxType = type;
            localStorage.setItem('chatFxType', type);
            // 버튼 active 표시
            ['snow','rain','cherry','stars','leaves','none'].forEach(fx => {
                const btn = document.getElementById('fxbtn-'+fx);
                if (btn) btn.classList.toggle('active', type === fx);
            });
            // 미리보기 레이블
            const lbl = document.getElementById('chat-bg-preview-label');
            if (lbl && type !== 'none') {
                const names = {snow:'❄️ 눈',rain:'🌧 비',cherry:'🌸 벚꽃',stars:'✨ 별빛',leaves:'🍂 낙엽'};
                lbl.textContent = (names[type]||type) + ' 선택됨 ✓ — 변경 적용 버튼을 눌러주세요';
                lbl.style.color = 'var(--month-accent)';
            } else if (lbl) {
                lbl.textContent = '';
            }
        }

        function startChatFx() {
            const canvas = document.getElementById('chat-fx-canvas');
            if (!canvas) return;
            if (chatFxAnim) { cancelAnimationFrame(chatFxAnim); chatFxAnim = null; }

            if (chatFxType === 'none') {
                canvas.style.opacity = '0';
                const ctx2 = canvas.getContext('2d');
                ctx2.clearRect(0,0,canvas.width,canvas.height);
                return;
            }

            // 캔버스 크기 설정 (0이면 카드 또는 화면 크기 사용)
            if (!canvas.width || canvas.width < 10) {
                const card = document.getElementById('chat-card');
                canvas.width  = (card?.offsetWidth)  || window.innerWidth  || 400;
                canvas.height = (card?.offsetHeight) || window.innerHeight || 700;
            }
            canvas.style.opacity = '1';
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 파티클 생성
            const count = chatFxType === 'rain' ? 120 : 80;
            const particles = Array.from({length: count}, () => makeParticle(canvas));

            function makeParticle(cv) {
                const fx = chatFxType;
                return {
                    x: Math.random() * cv.width,
                    y: Math.random() * cv.height,
                    r: fx==='rain'?1:Math.random()*4+2,
                    speed: fx==='rain'?8+Math.random()*6:1.5+Math.random()*2,
                    wind: fx==='rain'?2:Math.random()*1.5-0.75,
                    opacity: 0.4+Math.random()*0.5,
                    rot: Math.random()*360,
                    rotSpeed: (Math.random()-0.5)*3,
                };
            }

            function drawParticle(p) {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                const fx = chatFxType;
                if (fx==='snow') {
                    ctx.fillStyle = 'white';
                    ctx.shadowBlur = 4; ctx.shadowColor='white';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
                    ctx.fill();
                } else if (fx==='rain') {
                    ctx.strokeStyle = 'rgba(180,220,255,0.7)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x+p.wind*2, p.y+14);
                    ctx.stroke();
                } else if (fx==='cherry') {
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot * Math.PI/180);
                    ctx.font = `${p.r*3}px serif`;
                    ctx.fillText('🌸', -p.r, p.r);
                } else if (fx==='stars') {
                    ctx.fillStyle = `hsl(${Math.random()*60+30},100%,90%)`;
                    ctx.shadowBlur = 8; ctx.shadowColor='white';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r*0.5, 0, Math.PI*2);
                    ctx.fill();
                } else if (fx==='leaves') {
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot * Math.PI/180);
                    ctx.font = `${p.r*3}px serif`;
                    ctx.fillText(((Math.floor(p.rot/180)%2)+2)%2 ? '🍁' : '🍂', -p.r, p.r);   // rot가 음수일 때 undefined 표시되던 문제 수정
                }
                ctx.restore();
            }

            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach(p => {
                    drawParticle(p);
                    p.y += p.speed;
                    p.x += p.wind;
                    p.rot += p.rotSpeed;
                    if (p.y > canvas.height+20) { Object.assign(p, makeParticle(canvas)); p.y = -10; }
                    if (p.x > canvas.width+20)  p.x = -10;
                    if (p.x < -20) p.x = canvas.width+10;
                });
                chatFxAnim = requestAnimationFrame(animate);
            }
            animate();
        }

        // ══════════════════════════════════════════════════════
        // 🎨 채팅 배경 설정
        // ══════════════════════════════════════════════════════
        let chatBgType  = localStorage.getItem('chatBgType')  || 'none';
        let chatBgValue = localStorage.getItem('chatBgValue') || '';
        let chatBlur    = parseInt(localStorage.getItem('chatBlur')    || '0');
        let chatOpacity = parseInt(localStorage.getItem('chatOpacity') || '80');

        function applyChatBg() {
            const layer = document.getElementById('chat-bg-layer');
            if (!layer) return;
            layer.innerHTML  = '';
            layer.style.cssText = '';

            const op = chatOpacity / 100;  // 0.1 ~ 1.0

            if (chatBgType === 'color' && chatBgValue) {
                layer.style.position   = 'absolute';
                layer.style.inset      = '0';
                layer.style.zIndex     = '0';
                layer.style.background = chatBgValue;
                layer.style.opacity    = op.toFixed(2);
                layer.style.pointerEvents = 'none';

            } else if (chatBgType === 'image' && chatBgValue) {
                const img = document.createElement('img');
                img.src = chatBgValue;
                img.style.cssText = `
                    position:absolute; inset:0; width:100%; height:100%;
                    object-fit:cover; z-index:0; pointer-events:none;
                    filter:blur(${chatBlur}px); transform:scale(1.06);
                    opacity:${op.toFixed(2)};`;
                layer.appendChild(img);
            }

            // 날씨효과 동기화
            if (chatFxType && chatFxType !== 'none') {
                startChatFx();
            } else {
                const canvas = document.getElementById('chat-fx-canvas');
                if (canvas) { canvas.style.opacity = '0'; }
            }
        }

        function setChatBg(type, value) {
            // 선택값만 저장 (즉시 적용 X → 변경 버튼 클릭 시 적용)
            chatBgType  = type;
            chatBgValue = value;
            localStorage.setItem('chatBgType',  type);
            localStorage.setItem('chatBgValue', value);
            // 미리보기 레이블 업데이트
            const lbl = document.getElementById('chat-bg-preview-label');
            if (lbl) {
                if (type === 'none')  lbl.textContent = '';
                else if (type === 'color') lbl.textContent = '색상 선택됨 ✓ — 변경 적용 버튼을 눌러주세요';
                else if (type === 'image') lbl.textContent = '사진 선택됨 ✓ — 변경 적용 버튼을 눌러주세요';
                lbl.style.color = 'var(--month-accent)';
            }
        }

        function setChatBlur(val) {
            chatBlur = parseInt(val);
            localStorage.setItem('chatBlur', chatBlur);
            const valEl = document.getElementById('chat-blur-val');
            if (valEl) valEl.textContent = chatBlur + 'px';
        }

        function setChatOpacity(val) {
            chatOpacity = parseInt(val);
            localStorage.setItem('chatOpacity', chatOpacity);
            const valEl = document.getElementById('chat-opacity-val');
            if (valEl) valEl.textContent = chatOpacity + '%';
        }

        function onChatBgUpload(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => setChatBg('image', e.target.result);
            reader.readAsDataURL(file);
        }

        // 채팅 배경 적용 후 모달 닫기
        function applyChatBgAndClose() {
            applyChatBg();
            if (chatFxType && chatFxType !== 'none') {
                requestAnimationFrame(() => {
                    const canvas = document.getElementById('chat-fx-canvas');
                    const card   = document.getElementById('chat-card');
                    if (canvas && card) {
                        canvas.width  = card.offsetWidth  || window.innerWidth;
                        canvas.height = card.offsetHeight || window.innerHeight;
                    }
                    startChatFx();
                });
            } else {
                if (chatFxAnim) { cancelAnimationFrame(chatFxAnim); chatFxAnim = null; }
                const canvas = document.getElementById('chat-fx-canvas');
                if (canvas) {
                    canvas.style.opacity = '0';
                    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
                }
            }
            document.getElementById('chat-bg-modal').classList.add('hidden');
        }

        // 채팅 배경 전체 초기화
        function resetChatBgAll() {
            chatBgType = 'none'; chatBgValue = '';
            chatBlur = 0; chatOpacity = 80;
            chatFxType = 'none';
            localStorage.removeItem('chatBgType');
            localStorage.removeItem('chatBgValue');
            localStorage.removeItem('chatBlur');
            localStorage.removeItem('chatOpacity');
            localStorage.removeItem('chatFxType');
            if (chatFxAnim) { cancelAnimationFrame(chatFxAnim); chatFxAnim = null; }
            const canvas = document.getElementById('chat-fx-canvas');
            if (canvas) { canvas.style.opacity = '0'; const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }
            applyChatBg();
            document.getElementById('chat-bg-modal').classList.add('hidden');
        }

        // 미디어 패널 토글
        function toggleMediaPanel() {
            const panel = document.getElementById('chat-media-panel');
            if (!panel) return;
            const isOpen = panel.style.display !== 'none';
            panel.style.display = isOpen ? 'none' : 'grid';
            const btn = document.getElementById('media-btn');
            if (btn) btn.classList.toggle('open', !isOpen);   // + 아이콘이 ×로 회전
        }

        function openChatBgModal() {
            document.getElementById('chat-bg-modal').classList.remove('hidden');

            // 슬라이더 값 복원
            const blurRange    = document.getElementById('chat-blur-range');
            const opacityRange = document.getElementById('chat-opacity-range');
            const blurVal      = document.getElementById('chat-blur-val');
            const opacityVal   = document.getElementById('chat-opacity-val');
            if (blurRange)    blurRange.value        = chatBlur;
            if (opacityRange) opacityRange.value     = chatOpacity;
            if (blurVal)      blurVal.textContent    = chatBlur    + 'px';
            if (opacityVal)   opacityVal.textContent = chatOpacity + '%';

            // 날씨효과 버튼 active 복원
            ['snow','rain','cherry','stars','leaves','none'].forEach(fx => {
                const btn = document.getElementById('fxbtn-' + fx);
                if (btn) btn.classList.toggle('active', chatFxType === fx);
            });

            // 색상 탭을 기본으로 표시
            switchChatBgTab(document.querySelector('.chat-bg-tab[data-tab="color"]') || document.querySelector('.chat-bg-tab'));

            // 미리보기 레이블 현재 상태 반영
            const lbl = document.getElementById('chat-bg-preview-label');
            if (lbl) {
                if (chatBgType === 'color')   lbl.textContent = '현재: 색상 배경 적용 중';
                else if (chatBgType === 'image') lbl.textContent = '현재: 사진 배경 적용 중';
                else if (chatFxType !== 'none') {
                    const names = {snow:'❄️ 눈',rain:'🌧 비',cherry:'🌸 벚꽃',stars:'✨ 별빛',leaves:'🍂 낙엽'};
                    lbl.textContent = '현재: ' + (names[chatFxType]||chatFxType) + ' 효과 적용 중';
                } else lbl.textContent = '';
                lbl.style.color = '#94a3b8';
            }
        }

        // ══════════════════════════════════════════════════════
        // 🔔 알림 (뱃지 + 토스트 + 진동 + 소리)
        // ══════════════════════════════════════════════════════
        let chatNotifPermission = false;

        async function initChatNotif() {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') {
                try { chatNotifPermission = (await Notification.requestPermission()) === 'granted'; }
                catch(e) {}
            } else {
                chatNotifPermission = Notification.permission === 'granted';
            }
        }

        function updateChatBadge(unreadCount) {
            // 채팅 배너 뱃지
            const badge = document.getElementById('chat-unread-badge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                    badge.style.display = 'flex';
                } else {
                    badge.textContent = '';          // 숫자도 비워야 메뉴 배지에 이전 숫자가 남지 않음
                    badge.style.display = 'none';
                }
            }
            // 메뉴(드로어) 배지도 함께 갱신
            const dbg = document.getElementById('drw-badge');
            if (dbg) { dbg.textContent = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : ''; dbg.style.display = unreadCount > 0 ? 'inline-block' : 'none'; }
            // 앱 아이콘 뱃지 (PWA)
            setAppBadge(unreadCount);
        }

        function showChatToast(msg, sender) {
            const toast = document.getElementById('chat-toast');
            if (!toast) return;
            const preview = (msg||'').length > 40 ? (msg||'').slice(0,40)+'…' : (msg||'');
            toast.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:48px;height:48px;border-radius:50%;background:var(--month-grad-a);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">
                        ${typeof famAvatarHtml === 'function' ? famAvatarHtml(sender, 48) : (sender === '정우설' ? '👨' : '👩')}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;font-weight:800;color:white;margin-bottom:3px;">💬 ${escHtml(sender)}</div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.9);word-break:break-word;line-height:1.4;">${escHtml(preview)}</div>
                    </div>
                </div>
                <button onclick="document.getElementById('chat-toast').style.display='none';showSection('chat-section');"
                    style="width:100%;background:var(--month-header);border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:800;color:white;cursor:pointer;">
                    📩 채팅창으로 이동
                </button>`;
            toast.style.display = 'flex';
            toast.style.opacity = '1';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => { toast.style.display = 'none'; toast.style.opacity = '1'; }, 400);
            }, 5000);
        }

        function triggerChatNotif(msg, sender) {
            // 권한 최신 확인
            chatNotifPermission = ('Notification' in window) && Notification.permission === 'granted';

            // ① 진동 (기기 설정 따름)
            try { if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]); } catch(e) {}

            // ② 알림음 (기기 소리 설정 따름)
            try {
                const ctx  = new (window.AudioContext || window.webkitAudioContext)();
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.start(); osc.stop(ctx.currentTime + 0.5);
            } catch(e) {}

            // ③ 앱 내 토스트 팝업
            showChatToast(msg, sender);

            // ④ 시스템 알림 (상단바 + 잠금화면)
            // 앱을 보고 있으면 토스트로 충분, 서버 푸시가 켜져 있으면 서버가 알림을 보냄 → 중복 알림 방지
            if (!chatNotifPermission || document.visibilityState === 'visible' || window._famPushSub) return;
            const body = (msg||'').length > 50 ? (msg||'').slice(0,50)+'…' : (msg||'새 메시지');

            // SW registration으로 직접 showNotification (가장 확실한 방법)
            if (swReg) {
                swReg.showNotification('💬 ' + sender, {
                    body,
                    icon:  '/sulyeon-family-/icon-192.png',
                    badge: '/sulyeon-family-/icon-192.png',
                    tag:   'chat-message',
                    renotify: true,
                    vibrate: [200, 100, 200],
                    data: { url: '/sulyeon-family-/' }
                }).catch(() => {});
            } else if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CHAT_NOTIFY', sender, body });
            } else {
                // 직접 Notification
                try {
                    new Notification('💬 ' + sender, {
                        body, tag: 'chat-message', renotify: true,
                        icon: '/sulyeon-family-/icon-192.png',
                    });
                } catch(e) {}
            }
        }

        // ══════════════════════════════════════════════════════
        // 😊 이모티콘 팝업
        // ══════════════════════════════════════════════════════
        const EMOJI_LIST = [
            '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
            '🥰','😍','🤩','😘','😙','😚','🙂','🤗','🤭','😎',
            '🤓','😏','😒','😞','😔','😟','😕','😣','😖','😫',
            '😩','🥺','😢','😭','😤','😠','😡','🤯','😳','🥵',
            '🥶','😱','😨','😰','😥','😓','🤔','🤫','🤥','😶',
            '😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱',
            '😴','🤤','😪','😵','🤐','🥴','🤢','🤧','🤠','🥳',
            '😷','🤒','🤕','🤑','🤖','👽','👾','💀','☠️','👻',
            '👋','✋','🖐','👌','🤌','✌️','🤞','🤟','🤘','👍',
            '👎','✊','👏','🙌','🙏','💪','🦾','🖕','☝️','👆',
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
            '❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️',
            '🎉','🎊','🎈','🎁','🎀','🎂','🥂','🍾','🎆','🎇',
            '🔥','⭐','✨','💫','🌟','🌈','☀️','🌙','❄️','🌊',
            '🌺','🌸','🌹','🌻','🍀','🍁','🍂','🌿','🌱','🌵',
            '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
            '🍎','🍊','🍋','🍇','🍓','🍒','🍑','🍌','🥝','🍕',
            '🍔','🌮','🍜','🍣','🍦','🍩','🍫','🍭','☕','🧋',
            '✈️','🚗','🏠','🏖️','⛰️','🌴','🗺️','🧳','📸','🎭',
            '💌','📱','💻','🎵','🎮','⚽','🏀','🎯','🎲','🎨',
        ];

        function toggleEmojiPanel() {
            const panel = document.getElementById('chat-emoji-panel');
            if (!panel) return;
            if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
            const grid = panel.querySelector('div');
            if (grid && !grid.children.length) {
                grid.innerHTML = EMOJI_LIST.map(e =>
                    `<button onclick="insertEmoji('${e}')"
                        style="font-size:22px;width:36px;height:36px;border:none;background:transparent;cursor:pointer;border-radius:8px;transition:.1s;"
                        onmouseover="this.style.background='#f1f5f9'"
                        onmouseout="this.style.background='transparent'">${e}</button>`
                ).join('');
            }
            panel.style.display = 'block';
        }

        function insertEmoji(emoji) {
            const input = document.getElementById('chat-input');
            if (!input) return;
            const s = input.selectionStart, e = input.selectionEnd;
            input.value = input.value.slice(0,s) + emoji + input.value.slice(e);
            input.selectionStart = input.selectionEnd = s + emoji.length;
            input.focus();
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }

        // ══════════════════════════════════════════════════════
        // ✨ 재미나이 (Claude AI)
        // ══════════════════════════════════════════════════════

        function openGeminiWindow() {
            const w = document.getElementById('gemini-window');
            if (w) w.style.display = 'flex';
            history.pushState({ modal: 'gemini' }, '', '');
        }

        function closeGeminiWindow() {
            const w = document.getElementById('gemini-window');
            if (w) w.style.display = 'none';
        }

        function openAIService(url) {
            window.open(url, '_blank');
        }


