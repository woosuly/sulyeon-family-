function initRealtimeSync() {
            db.collection("schedules").onSnapshot(s => {
                schData = s.docs.map(d => d.data());
                renderSch();
                renderAssetCal();
                renderMainDashboard();
            });
            db.collection("albums").onSnapshot(s => {
                albumData = s.docs.map(d => d.data());
                renderFolders();
                if (currentFolderId) renderGallery();
            });
            db.collection("plans").onSnapshot(s => {
                planData = s.docs.map(d => d.data());
                renderPlans();
                renderMainDashboard(); // ← 여행 데이터 로드 시 대시보드 갱신
            });
            db.collection("assets").onSnapshot(s => {
                assetData = { "남편": [], "아내": [], "정우설": [], "한미연": [], "공통": [] };
                s.docs.forEach(d => {
                    const data = d.data();
                    const key = assetData[data.member] !== undefined ? data.member : '공통';
                    assetData[key].push(data);
                });
                if (document.getElementById('asset-section').classList.contains('active')) initAssetCharts();
                renderMainDashboard(); // ← 가계부 차트 갱신
                if (document.getElementById('asset-cal-section').classList.contains('active')) { renderAssetCal(); updateAssetCalSummary(); }
            });
            // [버그수정] doc.exists()  →  doc.exists (프로퍼티, 메서드 아님)
            db.collection("config").doc("mainPhoto").onSnapshot(doc => {
                if (doc.exists) {
                    const d = doc.data();
                    updatePhotoUI(d);
                    localStorage.setItem('localMainPhoto', JSON.stringify(d));
                }
            });
        }

        // ── 메인 사진 ──────────────────────────────────────────────────
        function updatePhotoUI(d) {
            const img = document.getElementById('main-photo');
            if (!img || !d.img) return;
            img.src = d.img;
            const z = parseFloat(d.z || 1);
            const x = d.x || 50;
            const y = d.y || 50;
            img.style.transform       = `scale(${z})`;
            img.style.transformOrigin = `${x}% ${y}%`;
            img.style.objectFit       = 'cover';
            img.style.objectPosition  = `${x}% ${y}%`;
            const zSlider = document.getElementById('zoom-slider');
            const xSlider = document.getElementById('x-slider');
            const ySlider = document.getElementById('y-slider');
            if (zSlider) zSlider.value = z;
            if (xSlider) xSlider.value = x;
            if (ySlider) ySlider.value = y;
        }

        async function saveMainPhotoConfig() {
            const d = {
                z: document.getElementById('zoom-slider')?.value || 1,
                x: document.getElementById('x-slider').value,
                y: document.getElementById('y-slider').value,
                img: document.getElementById('main-photo').src
            };
            localStorage.setItem('localMainPhoto', JSON.stringify(d));
            await db.collection("config").doc("mainPhoto").set(d);
        }

        function applyPhotoSettings() {
            const z = parseFloat(document.getElementById('zoom-slider')?.value || 1);
            const x = document.getElementById('x-slider').value;
            const y = document.getElementById('y-slider').value;
            const img = document.getElementById('main-photo');
            // scale로 확대/축소, objectPosition으로 위치 조절
            img.style.transform       = `scale(${z})`;
            img.style.transformOrigin = `${x}% ${y}%`;
            img.style.objectFit       = 'cover';
            img.style.objectPosition  = `${x}% ${y}%`;
        }

        // openPhotoAdjustModal → openLocationModal에 통합됨

        async function handleMainPhoto(input) {
            if (input.files && input.files[0]) {
                const r = new FileReader();
                r.readAsDataURL(input.files[0]);
                r.onload = async (e) => {
                    const comp = await compressImage(e.target.result, 1200);
                    document.getElementById('main-photo').src = comp;
                    // 업로드 시 항상 중간 사이즈(축소/확대 여지 있도록 1.0으로 초기화)
                    const zSlider = document.getElementById('zoom-slider');
                    const xSlider = document.getElementById('x-slider');
                    const ySlider = document.getElementById('y-slider');
                    if (zSlider) zSlider.value = 1;
                    if (xSlider) xSlider.value = 50;
                    if (ySlider) ySlider.value = 50;
                    applyPhotoSettings();
                };
            }
        }

