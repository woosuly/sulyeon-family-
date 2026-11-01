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
        }


