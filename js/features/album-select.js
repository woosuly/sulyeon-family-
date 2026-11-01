        // ── 앨범 개선 ────────────────────────────────────────────────────
        let photoSelectMode = false;
        let selectedPhotos  = new Set();

        function togglePhotoSelect() {
            photoSelectMode = !photoSelectMode;
            selectedPhotos.clear();
            document.getElementById('photo-select-btn').textContent = photoSelectMode ? '완료' : '선택';
            document.getElementById('photo-select-bar').style.display = photoSelectMode ? 'flex' : 'none';
            renderGallery();
        }

        function openAlbumLightbox(src) {
            document.getElementById('album-lightbox-img').src = src;
            document.getElementById('album-lightbox').style.display = 'flex';
            history.pushState({ modal: 'album-lightbox' }, '', '');
        }

        async function deleteSelectedPhotos() {
            if (!selectedPhotos.size) return;
            if (!confirm(`${selectedPhotos.size}개 사진을 삭제할까요?`)) return;
            const f = albumData.find(x => x.id === currentFolderId);
            if (!f) return;
            const removed = f.photos.filter((_,i) => selectedPhotos.has(i));
            f.photos = f.photos.filter((_,i) => !selectedPhotos.has(i));
            await db.collection('albums').doc(currentFolderId).update({ photos: firebase.firestore.FieldValue.arrayRemove(...removed) });
            removed.forEach(albumDelFile);
            selectedPhotos.clear();
            photoSelectMode = false;
            document.getElementById('photo-select-btn').textContent = '선택';
            document.getElementById('photo-select-bar').style.display = 'none';
            renderGallery();
        }

        function movePhotos() {
            if (!selectedPhotos.size) return;
            const ml = document.getElementById('photo-move-folder-list');
            ml.innerHTML = '';
            albumData.filter(f => f.id !== currentFolderId).forEach(f => {
                const btn = document.createElement('button');
                btn.style.cssText = 'display:block;width:100%;text-align:left;padding:12px 14px;border:none;border-bottom:1px solid #f1f5f9;background:white;font-size:13px;font-weight:600;cursor:pointer;';
                btn.textContent = '📁 ' + f.name;
                btn.onclick = async () => {
                    const src = albumData.find(x => x.id === currentFolderId);
                    const dst = albumData.find(x => x.id === f.id);
                    if (!src || !dst) return;
                    const moving = [...selectedPhotos].map(i => src.photos[i]);
                    dst.photos = [...(dst.photos||[]), ...moving];
                    src.photos = src.photos.filter((_,i) => !selectedPhotos.has(i));
                    const batch = db.batch();
                    batch.update(db.collection('albums').doc(src.id), { photos: firebase.firestore.FieldValue.arrayRemove(...moving) });
                    batch.update(db.collection('albums').doc(dst.id), { photos: firebase.firestore.FieldValue.arrayUnion(...moving) });
                    await batch.commit();
                    document.getElementById('photo-move-modal').classList.add('hidden');
                    selectedPhotos.clear(); photoSelectMode = false;
                    document.getElementById('photo-select-btn').textContent = '선택';
                    document.getElementById('photo-select-bar').style.display = 'none';
                };
                ml.appendChild(btn);
            });
            document.getElementById('photo-move-modal').classList.remove('hidden');
        }

        // openFolderModal 개선 - 이름수정/하위폴더 지원

        // showSection에 smart/asset-cal 추가

