        // ── 섹션 전환 ──────────────────────────────────────────────────

        // ════════════════════════════════════════════════
        // 🗂️ 드로어 네비게이션
        // ════════════════════════════════════════════════
        var _drwOpen=false;
        function toggleDrawer(){ _drwOpen?closeDrawer():openDrawer(); }
        function openDrawer(){
            _drwOpen=true;
            var p=document.getElementById('drw-panel'),o=document.getElementById('drw-ov');
            if(p) p.style.left='0';
            if(o){ o.style.display='block'; }
            // 프로필 동기화
            var nm=document.getElementById('drw-name'),av=document.getElementById('drw-avatar');
            var pn=document.getElementById('header-profile-name'),pa=document.getElementById('header-profile-avatar');
            if(nm&&pn) nm.textContent=pn.textContent||'–';
            if(av&&pa) av.textContent=pa.textContent||'👤';
            // 배지 동기화
            var bs=document.getElementById('chat-unread-badge'),bd=document.getElementById('drw-badge');
            if(bs&&bd){ var c=bs.textContent; if(c){bd.textContent=c;bd.style.display='inline-block';}else bd.style.display='none'; }
        }
        function closeDrawer(){
            _drwOpen=false;
            var p=document.getElementById('drw-panel'),o=document.getElementById('drw-ov');
            if(p) p.style.left='-270px';
            if(o) o.style.display='none';
        }
        function drawerGo(sectionId){
            closeDrawer();
            var map={'main-section':'di-main','schedule-section':'di-schedule','asset-section':'di-asset',
                     'photo-section':'di-photo','travel-section':'di-travel','chat-section':'di-chat','translator-section':'di-trans'};
            document.querySelectorAll('.drawer-item').forEach(function(el){el.classList.remove('active');});
            var did=map[sectionId]; if(did){var de=document.getElementById(did);if(de)de.classList.add('active');}
            setTimeout(function(){ showSection(sectionId); },200);
        }

        function showSection(id, pushHistory = true) {
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(id);
            if (target) {
                target.classList.add('active');
                // 번역기 진입 시 키 복원
                if(id==='translator-section'&&typeof timOnEnter==='function') timOnEnter();
                // 드로어 활성 동기화
                var _dm={'main-section':'di-main','schedule-section':'di-schedule','asset-section':'di-asset','photo-section':'di-photo','travel-section':'di-travel','chat-section':'di-chat','translator-section':'di-trans'};
                document.querySelectorAll('.drawer-item').forEach(function(el){el.classList.remove('active');});
                var _did=_dm[id]; if(_did){var _de=document.getElementById(_did);if(_de)_de.classList.add('active');}
                window.scrollTo(0, 0);
                // History API: 메인이 아닐 때만 pushState (뒤로가기 가능하게)
                if (pushHistory) {
                    if (id === 'main-section') {
                        history.replaceState({ section: id }, '', '');
                    } else {
                        history.pushState({ section: id }, '', '');
                    }
                }
                requestAnimationFrame(() => {
                    if (id === 'main-section') renderMainDashboard();
                    if (id === 'chat-section') { renderChatMessages(); markChatRead(); initChatUI(); }
                    if (id === 'schedule-section') renderSch();
                    if (id === 'asset-section') initAssetCharts();
                    if (id === 'asset-cal-section') { renderAssetCal(); updateAssetCalSummary(); }
                });
            }
        }

        // 뒤로가기 버튼 → 우선순위: 모달 > 팝업 > 라이트박스 > 폴더 > 섹션
        window.addEventListener('popstate', e => {
            // 맨 위에 떠 있는 것부터 하나만 닫음 (하단 시트·설정·프로필 확대·통역 크게 보기/마주보기)
            const top = [['fam-av-zoom', () => famAvatarZoomClose()], ['fam-sheet', () => famSheetClose()], ['map-ov', () => mapClose()], ['tk-big', () => talkBigClose()],
                         ['fam-settings', () => famCloseSettings()], ['tk-face', () => talkFaceClose()], ['chat-mpop-dim', () => chatMenuClose()], ['ib-modal', () => ibClose()]];
            for (const [id, close] of top) { const el = document.getElementById(id); if (el && el.style.display === 'flex') { close(); return; } }
        
            const state = e.state || {};

            // 1. 마스터 모달 (가계부 입력, 일정 입력 등)
            const masterModal = document.getElementById('master-modal');
            if (masterModal && masterModal.style.display === 'flex') {
                closeModal(); return;
            }

            // 2. sch-detail-modal (일정 상세)
            const schDetail = document.getElementById('sch-detail-modal');
            if (schDetail && !schDetail.classList.contains('hidden')) {
                schDetail.classList.add('hidden'); return;
            }

            // 3. sch-action-sheet
            const actionSheet = document.getElementById('sch-action-sheet');
            if (actionSheet && !actionSheet.classList.contains('hidden')) {
                actionSheet.classList.add('hidden'); return;
            }

            // 4. travel-detail-modal
            const travelDetail = document.getElementById('travel-detail-modal');
            if (travelDetail && !travelDetail.classList.contains('hidden')) {
                travelDetail.classList.add('hidden'); return;
            }

            // 5. asset-day-modal
            const assetDay = document.getElementById('asset-day-modal');
            if (assetDay && !assetDay.classList.contains('hidden')) {
                assetDay.classList.add('hidden'); return;
            }

            // 6. 라이트박스 (일반 사진)
            const lightbox = document.getElementById('lightbox');
            if (lightbox && lightbox.style.display !== 'none' && lightbox.style.display !== '') {
                lightbox.style.display = 'none'; return;
            }


            // 8. 재미나이 창
            const gemini = document.getElementById('gemini-window');
            if (gemini && gemini.style.display === 'flex') {
                closeGeminiWindow(); return;
            }

            // 9. 이모티콘 패널
            const emoji = document.getElementById('chat-emoji-panel');
            if (emoji && emoji.style.display !== 'none') {
                emoji.style.display = 'none'; return;
            }

            // 10. 프로필 모달
            const profileModal = document.getElementById('profile-modal');
            if (profileModal && profileModal.style.display === 'flex') {
                closeProfileModal(); return;
            }

            // 11. 앨범 폴더 내부 → 폴더 목록으로
            const photoDetail = document.getElementById('photo-detail-view');
            if (photoDetail && !photoDetail.classList.contains('hidden')) {
                backToFolders(); return;
            }

            // 12. 섹션 이동
            const id = state.section || 'main-section';
            showSection(id, false);
        });

        // 앱 최초 진입 시 history 초기화
        window.addEventListener('load', () => {
            history.replaceState({ section: 'main-section' }, '', '');
        });

