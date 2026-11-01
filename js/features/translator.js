        // ════════════════════════════════════════════════════════
        // 🌐 통번역 엔진
        // ════════════════════════════════════════════════════════

        // ── API 키 + 인증 ──
        var _GCLOUD_KEY=''; // ← 아래 timSetKey()로 설정하거나 직접 입력
        // Gemini 전용 키가 있으면 여기에: var _GEMINI_KEY='';
        // Firebase 키를 번역에도 사용하려면 아래 주석 해제:
        // var _GCLOUD_KEY=document.querySelector('[data-apikey]')?.dataset.apikey||'';
        function getApiKey(){return _GCLOUD_KEY||firebaseConfig?.apiKey||'';}
        function isFamilyAuthed(){return localStorage.getItem('familyAuthed')==='yes';}
        function familyAuthToggle(){if(isFamilyAuthed()){if(confirm('로그아웃?')){localStorage.removeItem('familyAuthed');updateAuthUI();}}else openFamilyAuthModal();}
        function timSetKey(){var k=prompt('Gemini API 키를 입력하세요:');if(k&&k.trim()){_GCLOUD_KEY=k.trim();localStorage.setItem('timApiKey',k.trim());alert('✅ 키 저장됨');}}
        function openFamilyAuthModal(){var m=document.getElementById('family-auth-modal');if(m){m.style.display='flex';document.getElementById('family-pw-input').value='';history.pushState({fa:1},'');}}
        function submitFamilyAuth(){var pw=(document.getElementById('family-pw-input').value||'').trim(),st=localStorage.getItem('familyPassword');if(!st){alert('설정된 암호가 없습니다. 먼저 암호를 설정하세요.');openSetPasswordModal();return;}if(pw===st){localStorage.setItem('familyAuthed','yes');document.getElementById('family-auth-modal').style.display='none';updateAuthUI();alert('✅ 인증 완료!');}else{alert('❌ 틀림');document.getElementById('family-pw-input').value='';}}
        function openSetPasswordModal(){document.getElementById('family-setpw-modal').style.display='flex';document.getElementById('family-setpw-input').value='';}
        function saveNewPassword(){var pw=(document.getElementById('family-setpw-input').value||'').trim();if(!pw||pw.length<4){alert('4자리 이상');return;}localStorage.setItem('familyPassword',pw);document.getElementById('family-setpw-modal').style.display='none';alert('✅ 변경됨');}
        function updateAuthUI(){var btn=document.getElementById('family-auth-btn');if(btn)btn.textContent=isFamilyAuthed()?'🔓':'🔑';}

        // ════════ 티모시 번역기 v3 ════════
        const TIM_L=[{n:'한국어',s:'KOR',f:'🇰🇷',g:'ko',sr:'ko-KR'},{n:'영어',s:'ENG',f:'🇺🇸',g:'en',sr:'en-US'},{n:'이탈리아어',s:'ITA',f:'🇮🇹',g:'it',sr:'it-IT'},{n:'중국어',s:'CHN',f:'🇨🇳',g:'zh',sr:'zh-CN'},{n:'일본어',s:'JPN',f:'🇯🇵',g:'ja',sr:'ja-JP'},{n:'프랑스어',s:'FRA',f:'🇫🇷',g:'fr',sr:'fr-FR'},{n:'베트남어',s:'VNM',f:'🇻🇳',g:'vi',sr:'vi-VN'},{n:'태국어',s:'THA',f:'🇹🇭',g:'th',sr:'th-TH'},{n:'포르투갈어',s:'POR',f:'🇵🇹',g:'pt',sr:'pt-PT'}];
        var timSrc=TIM_L[0],timTgt=TIM_L[2],timSR=null,timLast='';
        var timSitU=JSON.parse(localStorage.getItem('timSitU')||'{}');
        const TIM_SIT={'식당':['예약하고 싶습니다','메뉴판 주세요','추천 메뉴가 뭔가요?','이거 매운가요?','알레르기가 있어요','채식 메뉴 있나요?','계산서 부탁합니다','카드 되나요?','포장 가능한가요?','물 주세요','디저트 추천해주세요','와인 추천해주세요','이 요리 재료가 뭔가요?','세트 메뉴 있나요?','어린이 메뉴 있나요?','팁은 포함인가요?','창가 자리 주세요','얼마나 기다려야 하나요?','영수증 주세요','정말 맛있어요'],'호텔':['체크인 하려구요','체크아웃 시간 언제예요?','와이파이 비번 뭔가요?','수건 더 주세요','조식 몇 시부터예요?','방 바꿀 수 있나요?','에어컨 안 돼요','택시 불러주세요','짐 보관 가능한가요?','모닝콜 부탁합니다','전망 좋은 방 주세요','청소 부탁합니다','연박하려구요','근처 식당 추천해주세요','영수증 주세요','금고 사용법 알려주세요','미니바 가격 얼마예요?','룸서비스 주문할게요','늦은 체크아웃 가능한가요?','조용한 방으로 주세요'],'교통':['표 사고 싶어요','이 버스 어디로 가나요?','환승해야 하나요?','막차 몇 시예요?','공항까지 어떻게 가나요?','택시 미터기 켜주세요','여기서 내려주세요','편도 왕복 티켓 주세요','좌석 지정 가능한가요?','다음 정거장 어디예요?','지연되고 있나요?','플랫폼 어디예요?','어린이 요금 있나요?','짐 보관함 있나요?','노선도 있나요?','시간표 알려주세요','분실물 신고할게요','공항 셔틀 있나요?','정기권 있나요?','와이파이 되나요?'],'병원':['아파서 왔어요','열이 나요','여기가 아파요','알레르기 있어요','약 처방해주세요','영어 가능한 의사 있나요?','보험 청구 서류 주세요','응급실 어디예요?','얼마나 기다려야 하나요?','두통이 있어요','속이 안 좋아요','약 복용법 알려주세요','입원해야 하나요?','검사 비용 얼마예요?','다쳤어요','처방전 발급해주세요','약국 어디예요?','전문의 진료 받고 싶어요','진단서 발급 가능한가요?','보험 적용되나요?'],'경찰서':['도움이 필요합니다','지갑 잃어버렸어요','여권 분실했어요','도둑 맞았어요','사고 났어요','대사관 연락해주세요','통역사 필요해요','신고서 작성할게요','CCTV 확인 가능한가요?','분실물 센터 어디예요?','차량 사고 신고입니다','증거 사진 있어요','경찰 보고서 필요해요','임시 서류 발급해주세요','도난 당했어요','보험 서류 주세요','대사관 번호 알려주세요','긴급 연락처 필요해요','범인 인상착의 설명할게요','귀중품 없어졌어요'],'공항':['탑승구 어디예요?','지연됐나요?','수하물 안 나와요','환승 어디서 하나요?','비행기 놓쳤어요','기내 반입 가능한가요?','좌석 업그레이드 가능한가요?','면세점 어디예요?','SIM카드 살 수 있나요?','탑승 시간 언제예요?','게이트 변경됐나요?','출국 수속 어디서 하나요?','세관 신고할 것 있어요','셔틀버스 있나요?','짐 맡길 수 있나요?','환전소 어디예요?','비자 필요한가요?','입국 카드 작성법 알려주세요','수하물 찾는 곳 어디예요?','유모차 대여 가능한가요?'],'쇼핑':['이거 얼마예요?','좀 깎아주세요','다른 색상 있나요?','사이즈 안 맞아요','교환 가능한가요?','환불하고 싶어요','포장해 주세요','세금 환급 되나요?','입어봐도 되나요?','재고 있나요?','현금 할인 있나요?','진품인가요?','배송 가능한가요?','영수증 주세요','선물 포장 부탁해요','품질 보증 있나요?','카드 되나요?','면세 가격인가요?','인기 상품 뭔가요?','추천 상품 알려주세요']};
        function timUpdateUI(){var sf=document.getElementById('tim-src-flag'),sn=document.getElementById('tim-src-name'),tf=document.getElementById('tim-tgt-flag'),tn=document.getElementById('tim-tgt-name');if(sf)sf.textContent=timSrc.f;if(sn)sn.textContent=timSrc.s;if(tf)tf.textContent=timTgt.f;if(tn)tn.textContent=timTgt.s;}
        function timSwap(){var t=timSrc;timSrc=timTgt;timTgt=t;timUpdateUI();}
        var _timLD='tgt';
        function timOpenLang(d){_timLD=d;document.getElementById('tim-lang-modal').style.display='flex';history.pushState({timLang:1},'');}
        function timPickLang(i){if(_timLD==='src')timSrc=TIM_L[i];else timTgt=TIM_L[i];timUpdateUI();document.getElementById('tim-lang-modal').style.display='none';}
        // ════════════════════════════════════════════════════
        // 🚀 티모시 v4 엔진
        // ════════════════════════════════════════════════════

        // ── API 키 관리 ──
        // ════════════════════════════════════════════════════════════════
        // 🤖 멀티 AI 엔진 라우터 v1
        //
        //  ┌─ 기본 모드 (키 1개) ──────────────────────────────────────────
        //  │  등록된 단일 키 엔진이 번역·OCR·통역 모두 처리
        //  │
        //  └─ 최적화 모드 (키 3개) ─────────────────────────────────────────
        //     [번역]  Claude  — 문맥 파악 & 매끄러운 자연어 번역
        //     [OCR]   GPT-4o  — 다양한 레이아웃·표 인식 정확도
        //     [통역]  Gemini  — 저지연 오디오·음성 멀티모달 처리
        //
        //  Fallback: 지정 엔진 오류 시 등록된 다른 엔진 자동 재시도
        // ════════════════════════════════════════════════════════════════

        // ── 키 저장/로드 ────────────────────────────────────────────────
        function timGetKeys(){
            return {
                gemini:  localStorage.getItem('timKey_gemini')  || _GCLOUD_KEY || '',
                claude:  localStorage.getItem('timKey_claude')  || '',
                gpt:     localStorage.getItem('timKey_gpt')     || ''
            };
        }
        // 하위 호환 (단일키 참조)
        function timGetKey(){
            var keys = timGetKeys();
            return keys.gemini || keys.claude || keys.gpt || '';
        }
        function timHasAllKeys(){
            var k = timGetKeys();
            return !!(k.gemini && k.claude && k.gpt);
        }
        function timGetEngineMode(){
            var k = timGetKeys();
            var count = [k.gemini,k.claude,k.gpt].filter(Boolean).length;
            if(count===0) return 'none';
            if(count>=3)  return 'optimal';  // 3개 → 기능별 최적 엔진
            return 'basic';                   // 1~2개 → 단일 엔진 폴백
        }
        // 기능별 최적 엔진 키 반환 (없으면 가용 키 fallback)
        function timGetKeyFor(task){
            // task: 'translate' | 'ocr' | 'interpret'
            var k = timGetKeys();
            var mode = timGetEngineMode();
            if(mode === 'optimal'){
                if(task==='translate' && k.claude)   return {key:k.claude,  engine:'claude'};
                if(task==='ocr'       && k.gpt)      return {key:k.gpt,     engine:'gpt'};
                if(task==='interpret' && k.gemini)   return {key:k.gemini,  engine:'gemini'};
            }
            // 기본/폴백: 등록된 키 우선순위 gemini > claude > gpt
            var fallback = k.gemini||k.claude||k.gpt;
            var eng = k.gemini?'gemini': k.claude?'claude':'gpt';
            return fallback ? {key:fallback, engine:eng} : null;
        }

        // ── 모달 제어 ────────────────────────────────────────────────────
        function timOpenApiKeyModal(){
            var k = timGetKeys();
            var g=document.getElementById('key-gemini'),
                c=document.getElementById('key-claude'),
                p=document.getElementById('key-gpt');
            if(g) g.value=k.gemini||'';
            if(c) c.value=k.claude||'';
            if(p) p.value=k.gpt||'';
            timUpdateKeyBadges();
            var modal=document.getElementById('tim-apikey-modal');
            if(modal) modal.style.display='flex';
        }
        function timCloseApiKeyModal(){
            var modal=document.getElementById('tim-apikey-modal');
            if(modal) modal.style.display='none';
        }
        function timUpdateKeyBadges(){
            var k=timGetKeys();
            var pairs=[['key-gemini','key-gemini-status',k.gemini],
                       ['key-claude','key-claude-status',k.claude],
                       ['key-gpt',   'key-gpt-status',   k.gpt]];
            pairs.forEach(function(p){
                var el=document.getElementById(p[1]);
                if(el) el.textContent=p[2]?'✅':'';
            });
            var badge=document.getElementById('tim-engine-badge');
            if(!badge) return;
            var mode=timGetEngineMode();
            if(mode==='none'){
                badge.style.background='#fef2f2'; badge.style.borderColor='#fecaca'; badge.style.color='#991b1b';
                badge.innerHTML='⚠️ API 키 없음 — 키를 1개 이상 등록해 주세요';
            } else if(mode==='optimal'){
                badge.style.background='#f0fdf4'; badge.style.borderColor='#86efac'; badge.style.color='#166534';
                badge.innerHTML='🚀 <b>최적화 모드</b> — Claude 번역 · GPT OCR · Gemini 통역';
            } else {
                var k2=timGetKeys();
                var eng=k2.gemini?'Gemini':k2.claude?'Claude':'GPT';
                badge.style.background='#eff6ff'; badge.style.borderColor='#bfdbfe'; badge.style.color='#1d4ed8';
                badge.innerHTML='🔵 <b>기본 모드</b> — '+eng+' 단일 엔진으로 모든 기능 처리';
            }
        }
        function timSaveAllKeys(){
            var g=(document.getElementById('key-gemini').value||'').trim();
            var c=(document.getElementById('key-claude').value||'').trim();
            var p=(document.getElementById('key-gpt').value||'').trim();
            if(g){ localStorage.setItem('timKey_gemini',g); _GCLOUD_KEY=g; }
            else  localStorage.removeItem('timKey_gemini');
            if(c) localStorage.setItem('timKey_claude',c);
            else  localStorage.removeItem('timKey_claude');
            if(p) localStorage.setItem('timKey_gpt',p);
            else  localStorage.removeItem('timKey_gpt');
            timUpdateKeyBadges();
            var st=document.getElementById('tim-apikey-modal-status');
            if(st){
                st.style.cssText='font-size:13px;font-weight:800;color:#166534;text-align:center;padding:8px 0;min-height:16px;margin-bottom:10px;';
                st.textContent='✅ API 키가 등록되었습니다!';
            }
            setTimeout(function(){
                if(st){ st.textContent=''; st.style.cssText='font-size:11px;color:#166534;text-align:center;min-height:16px;margin-bottom:10px;'; }
                timCloseApiKeyModal();
            },2000);
        }

        // ── 하위 호환 (구 timSaveKey / timToggleKeyPanel) ────────────────
        function timSaveKey(){ timOpenApiKeyModal(); }
        function timToggleKeyPanel(){ timOpenApiKeyModal(); }
        function timKeyStatus(msg,color){
            var el=document.getElementById('tim-key-status');
            if(el){ el.textContent=msg; el.style.color=color; }
        }
        function timOnEnter(){
            var k=timGetKey();
            var el=document.getElementById('tim-api-input');
            if(el&&k) el.value=k;
            timUpdateUI();
        }

        // ── 사진 번역 모달 ───────────────────────────────────────────────
        function timOpenPhotoModal(){
            var m=document.getElementById('tim-photo-modal');
            if(m) m.style.display='flex';
        }
        function timClosePhotoModal(){
            var m=document.getElementById('tim-photo-modal');
            if(m) m.style.display='none';
        }

        // ── 지우기 ───────────────────────────────────────────────────────
        function timClearInput(){
            var i=document.getElementById('tim-input');
            if(i) i.value='';
            document.getElementById('tim-output').innerHTML='';
        }

        // ════════════════════════════════════════════════════════════════
        // 🚀 AI 엔진별 API 호출 함수
        // ════════════════════════════════════════════════════════════════

        // ── 모델: ⚙️ 설정에서 고른 모델을 그대로 사용 (구 모델 하드코딩 제거) ──
        function _timModel(p){
            if (typeof famModel === 'function') return famModel(p);
            return {gemini:'gemini-3.6-flash', claude:'claude-haiku-5-5', gpt:'gpt-5.4-mini'}[p];
        }

        // ── Gemini (번역·통역·OCR 기본) ──────────────────────────────────
        async function _callGemini(key, prompt, img, mime){
            mime=mime||'image/jpeg';
            var parts=[];
            if(img) parts.push({inline_data:{mime_type:mime,data:img}});
            parts.push({text:prompt});
            var ctrl=new AbortController();
            var timer=setTimeout(function(){ctrl.abort();},30000);
            var r=await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(_timModel('gemini'))+':generateContent?key='+key,
                {method:'POST',headers:{'Content-Type':'application/json'},
                 body:JSON.stringify({contents:[{parts:parts}],generationConfig:{maxOutputTokens:(img?800:256),temperature:0.2}}),signal:ctrl.signal}
            );
            clearTimeout(timer);
            if(!r.ok){
                var ed=await r.json().catch(function(){return{};});
                throw new Error('Gemini '+r.status+': '+((ed.error&&ed.error.message)||r.statusText));
            }
            var d=await r.json();
            var t=d.candidates&&d.candidates[0]&&d.candidates[0].content&&
                  d.candidates[0].content.parts&&d.candidates[0].content.parts[0]&&
                  d.candidates[0].content.parts[0].text;
            return t?t.trim():'';
        }

        // ── Claude (번역 최적) ────────────────────────────────────────────
        async function _callClaude(key, prompt){
            var ctrl=new AbortController();
            var timer=setTimeout(function(){ctrl.abort();},30000);
            var r=await fetch('https://api.anthropic.com/v1/messages',{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'x-api-key':key,
                    'anthropic-version':'2023-06-01',
                    'anthropic-dangerous-direct-browser-access':'true'
                },
                body:JSON.stringify({
                    model:_timModel('claude'),
                    max_tokens:512,
                    messages:[{role:'user',content:prompt}]
                }),
                signal:ctrl.signal
            });
            clearTimeout(timer);
            if(!r.ok){
                var ed=await r.json().catch(function(){return{};});
                throw new Error('Claude '+r.status+': '+((ed.error&&ed.error.message)||r.statusText));
            }
            var d=await r.json();
            return (d.content&&d.content[0]&&d.content[0].text)||'';
        }

        // ── GPT-4o (OCR 최적) ────────────────────────────────────────────
        async function _callGPT(key, prompt, img, mime){
            var messages=[{role:'user',content:[]}];
            if(img){
                messages[0].content.push({type:'image_url',image_url:{url:'data:'+(mime||'image/jpeg')+';base64,'+img}});
            }
            messages[0].content.push({type:'text',text:prompt});
            var ctrl=new AbortController();
            var timer=setTimeout(function(){ctrl.abort();},30000);
            var r=await fetch('https://api.openai.com/v1/chat/completions',{
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
                body:JSON.stringify({model:_timModel('gpt'),messages:messages,max_completion_tokens:1000}),
                signal:ctrl.signal
            });
            clearTimeout(timer);
            if(!r.ok){
                var ed=await r.json().catch(function(){return{};});
                throw new Error('GPT '+r.status+': '+((ed.error&&ed.error.message)||r.statusText));
            }
            var d=await r.json();
            return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||'';
        }

        // ── 통합 라우터 (기능별 최적 엔진 + fallback) ────────────────────
        async function timCallAI(task, prompt, img, mime){
            // task: 'translate' | 'ocr' | 'interpret'
            var keys=timGetKeys();
            var mode=timGetEngineMode();
            if(mode==='none') throw new Error('API 키 없음 — 🔑 아이콘을 눌러 키를 등록해 주세요.');

            // 기능별 엔진 순서 결정
            // ★ 통역(interpret)은 항상 Gemini 단독 — Claude는 브라우저 CORS 제한으로 느림
            var order=[];
            if(mode==='optimal'){
                if(task==='translate') order=[{e:'gemini',k:keys.gemini},{e:'gpt',k:keys.gpt}]; // Claude CORS 제거
                else if(task==='ocr')  order=[{e:'gpt',k:keys.gpt},{e:'gemini',k:keys.gemini}];
                else                   order=[{e:'gemini',k:keys.gemini}]; // 통역: Gemini만
            } else {
                // 기본 모드: Gemini → GPT → Claude 순 (속도 우선)
                ['gemini','gpt','claude'].forEach(function(e){
                    if(keys[e]) order.push({e:e,k:keys[e]});
                });
            }
            order=order.filter(function(o){return !!o.k;});

            var lastErr=null;
            for(var i=0;i<order.length;i++){
                try{
                    var o=order[i];
                    console.log('[timCallAI] task='+task+' engine='+o.e+(i>0?' (fallback '+i+')':''));
                    if(o.e==='claude') return await _callClaude(o.k, prompt);
                    if(o.e==='gpt')    return await _callGPT(o.k,   prompt, img, mime);
                    return await _callGemini(o.k, prompt, img, mime);
                }catch(e){
                    lastErr=e;
                    console.warn('[timCallAI] '+order[i].e+' 실패, 다음 엔진 시도:', e.message);
                }
            }
            throw new Error((lastErr&&lastErr.message)||'모든 AI 엔진 호출 실패');
        }

        // ── 하위 호환: timGemini → timCallAI 라우팅 ─────────────────────
        async function timGemini(prompt,img,mime){
            return await timCallAI(img?'ocr':'translate', prompt, img, mime);
        }

        // ── JSON 파싱 가드 ──
        function timParseJSON(raw){
            if(!raw) return null;
            var clean=raw.replace(/```json[\s\S]*?```/gi,function(s){return s.replace(/```json|```/gi,'');})
                         .replace(/```[\s\S]*?```/gi,function(s){return s.replace(/```/gi,'');}).trim();
            var m=clean.match(/\{[\s\S]*\}/);
            if(!m) return null;
            try{ return JSON.parse(m[0]); }catch(e){ return null; }
        }
        function timParseJSONArray(raw){
            if(!raw) return null;
            var clean=raw.replace(/```json[\s\S]*?```/gi,function(s){return s.replace(/```json|```/gi,'');})
                         .replace(/```[\s\S]*?```/gi,function(s){return s.replace(/```/gi,'');}).trim();
            var m=clean.match(/\[[\s\S]*\]/);
            if(!m) return null;
            try{ return JSON.parse(m[0]); }catch(e){ return null; }
        }

        // (중복 정의 제거: 위 timCallAI 라우터 버전의 timGemini를 사용)

        // ── timGT: 배치 번역 래퍼 (하위 호환) ──
        async function timGT(q,tgt,src){
            var isArr=Array.isArray(q), list=isArr?q:[q];
            var tgtName=(TIM_L.find(function(l){return l.g===tgt;})||{n:tgt}).n;
            var srcName=(TIM_L.find(function(l){return l.g===src;})||{n:src||'자동'}).n;
            var prompt='아래 문장들을 '+srcName+'에서 '+tgtName+'('+tgt+')으로 번역. JSON 배열만 출력. 예: ["번역1","번역2"]\n\n'+list.map(function(s,i){return (i+1)+'. '+s;}).join('\n');
            var raw=await timGemini(prompt);
            var arr=timParseJSONArray(raw);
            if(!arr||!arr.length) arr=raw.split('\n').map(function(l){return l.replace(/^\d+\.\s*/,'').trim();}).filter(Boolean);
            while(arr.length<list.length) arr.push('');
            return isArr?arr:(arr[0]||'');
        }

        // ── 탭 전환 ──
        // ── 마이크 권한 요청 ────────────────────────────────────────────
        async function _timGrantMic() {
            if (window._micGranted) return true;
            try {
                var s = await navigator.mediaDevices.getUserMedia({ audio: true });
                s.getTracks().forEach(function(t) { t.stop(); });
                window._micGranted = true;
                return true;
            } catch(e) {
                alert('마이크 권한이 거부되었거나 사용할 수 없습니다.\n브라우저 설정에서 마이크를 허용해 주세요.');
                return false;
            }
        }

        // ════════════════════════════════════════════════════════════════
        // 🎙️ 통역 엔진 v3 — 모드 선택 모달 + AI 실시간 동시통역
        //   · 탭 클릭 → 모드 선택 모달 팝업
        //   · 일반 모드: 마이크 번갈아 누르기 (continuous STT)
        //   · AI 실시간 모드: 상대 언어만 무한 락온 + 자동 TTS
        //   · TTS: voices 프리캐시로 딜레이 없이 즉시 발화
        // ════════════════════════════════════════════════════════════════

        // ── 탭 전환 (통역 탭은 모드 선택 모달 인터셉트) ─────────────────
        function timSwitchTab(idx) {
            for (var i = 0; i < 3; i++) {
                var btn = document.getElementById('timTab' + i);
                var pan = document.getElementById('timPanel' + i);
                if (btn) btn.classList.toggle('active', i === idx);
                if (pan) {
                    pan.style.display = (i === idx) ? 'flex' : 'none';
                    if (i === idx) pan.style.flexDirection = 'column';
                }
            }
            if (idx === 1) {
                timUpdInterpLbl();
                // 기존 마이크 엔진 셧다운 후 모드 선택 팝업
                timStopMyMic();
                timStopPeerMic();
                timStopLiveMode();
                var modal = document.getElementById('tim-interp-mode-modal');
                if (modal) modal.style.display = 'flex';
            }
        }

        function timUpdInterpLbl() {
            var a = document.getElementById('tim-my-lbl');
            var b = document.getElementById('tim-peer-lbl');
            if (a) a.textContent = timSrc.f + ' ' + timSrc.n;
            if (b) b.textContent = timTgt.f + ' ' + timTgt.n;
        }

        // ── 모드 선택 콜백 ────────────────────────────────────────────────
        function timSelectInterpMode(mode) {
            var modal = document.getElementById('tim-interp-mode-modal');
            if (modal) modal.style.display = 'none';
            if (mode === 'live') {
                timStartLiveMode();
            }
            // 'normal'은 아무 동작 없이 일반 마이크 버튼 UI 대기
        }

        // ════════════════════════════════════════════════════════════════
        // 🌟 AI 실시간 동시통역 모드 (상대 언어 무한 락온)
        // ════════════════════════════════════════════════════════════════
        var _timMyR = null, _timPeerR = null, _timLiveR = null;
        var _timMyOn = false, _timPeerOn = false, _timLiveOn = false;

        async function timStartLiveMode() {
            if (!timGetKey()) { timOpenApiKeyModal(); return; }
            if (!await _timGrantMic()) return;

            timStopMyMic();
            timStopPeerMic();

            var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) { alert('Chrome이 필요합니다.'); return; }

            _timLiveR = new SR();
            _timLiveR.lang = timTgt.sr;       // ★ 상대방 언어만 타겟
            _timLiveR.interimResults = true;
            _timLiveR.continuous = true;       // ★ 무한 연속 청취
            _timLiveOn = true;

            // PEER 버튼 UI 라이브 모드 표시
            var pBtn = document.getElementById('tim-peer-btn');
            var pIco = document.getElementById('tim-peer-mic-icon');
            if (pBtn) { pBtn.style.background = '#f3e8ff'; pBtn.style.borderColor = '#c084fc'; }
            if (pIco) { pIco.style.background = '#e9d5ff'; pIco.textContent = '✨'; }
            _timPeerS('✨ AI 동시통역 가동 중');
            _timSetInterim('상대방 발화 대기 중...');

            _timLiveR.onresult = function(e) {
                var interim = '', final = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                    else interim += e.results[i][0].transcript;
                }
                if (interim) _timSetInterim('⚡ "' + interim + '"');
                if (final.trim()) {
                    _timSetInterim('🤖 번역 중...');
                    _timPeerS('🤖 동시통역 중...');
                    _timTrBubble(final.trim(), 'peer', timTgt.n, timSrc.n, timSrc.g, timSrc.sr);
                }
            };
            _timLiveR.onerror = function(e) {
                if (e.error === 'no-speech') return;
                console.warn('[LiveMode]', e.error);
            };
            // ★ 무한 재시작 가드
            _timLiveR.onend = function() {
                if (_timLiveOn && _timLiveR) {
                    try { _timLiveR.start(); } catch(err) {}
                }
            };
            try { _timLiveR.start(); } catch(err) { console.error(err); }
        }

        function timStopLiveMode() {
            _timLiveOn = false;
            if (_timLiveR) { try { _timLiveR.stop(); _timLiveR.abort(); } catch(e) {} }
            _timLiveR = null;
            // PEER 버튼 UI 원복
            var pBtn = document.getElementById('tim-peer-btn');
            var pIco = document.getElementById('tim-peer-mic-icon');
            if (pBtn) { pBtn.style.background = '#f0fdf4'; pBtn.style.borderColor = '#10b981'; }
            if (pIco) { pIco.style.background = '#d1fae5'; pIco.textContent = '🎙️'; }
            _timPeerS('● 대기 중');
            _timSetInterim('');
        }

        // ════════════════════════════════════════════════════════════════
        // 일반 모드 — 내 음성 (연속 STT)
        // ════════════════════════════════════════════════════════════════
        async function timGrantMic() { return await _timGrantMic(); }
        async function timStartMyMic() {
            if (!timGetKey()) { timOpenApiKeyModal(); return; }
            if (!await _timGrantMic()) return;
            if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
                alert('Chrome이 필요합니다.'); return;
            }
            if (_timLiveOn) timStopLiveMode();
            if (_timPeerOn) timStopPeerMic();

            var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            _timMyR = new SR();
            _timMyR.lang = timSrc.sr;
            _timMyR.interimResults = true;
            _timMyR.continuous = true;
            _timMyOn = true;
            _timMyBtnUI(true);
            _timMyS('🔴 듣는 중...');

            _timMyR.onresult = function(e) {
                var interim = '', final = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                    else interim += e.results[i][0].transcript;
                }
                if (interim) _timSetInterim('"' + interim + '"');
                if (final.trim()) {
                    _timSetInterim('');
                    _timMyS('🐱 통역 중...');
                    _timTrBubble(final.trim(), 'my', timSrc.n, timTgt.n, timTgt.g, timTgt.sr);
                }
            };
            _timMyR.onerror = function(e) {
                if (e.error === 'no-speech') return;
                _timMyS('오류: ' + e.error);
            };
            _timMyR.onend = function() {
                if (_timMyOn && _timMyR) { try { _timMyR.start(); } catch(e) {} }
                else timStopMyMic();
            };
            try { _timMyR.start(); } catch(e) { console.error(e); }
        }

        function timStopMyMic() {
            _timMyOn = false;
            if (_timMyR) { try { _timMyR.stop(); _timMyR.abort(); } catch(e) {} }
            _timMyR = null;
            _timMyBtnUI(false);
            _timMyS('● 대기 중');
            _timSetInterim('');
        }

        // ════════════════════════════════════════════════════════════════
        // 일반 모드 — 상대 음성 (연속 STT)
        // ════════════════════════════════════════════════════════════════
        async function timStartPeerMic() {
            if (!timGetKey()) { timOpenApiKeyModal(); return; }
            if (!await _timGrantMic()) return;
            if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
                alert('Chrome이 필요합니다.'); return;
            }
            if (_timLiveOn) timStopLiveMode();
            if (_timMyOn) timStopMyMic();

            var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            _timPeerR = new SR();
            _timPeerR.lang = timTgt.sr;
            _timPeerR.interimResults = true;
            _timPeerR.continuous = true;
            _timPeerOn = true;
            _timPeerBtnUI(true);
            _timPeerS('🔴 듣는 중...');

            _timPeerR.onresult = function(e) {
                var interim = '', final = '';
                for (var i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                    else interim += e.results[i][0].transcript;
                }
                if (interim) _timSetInterim('"' + interim + '"');
                if (final.trim()) {
                    _timSetInterim('');
                    _timPeerS('🐱 역통역 중...');
                    _timTrBubble(final.trim(), 'peer', timTgt.n, timSrc.n, timSrc.g, timSrc.sr);
                }
            };
            _timPeerR.onerror = function(e) {
                if (e.error === 'no-speech') return;
                _timPeerS('오류: ' + e.error);
            };
            _timPeerR.onend = function() {
                if (_timPeerOn && _timPeerR) { try { _timPeerR.start(); } catch(e) {} }
                else timStopPeerMic();
            };
            try { _timPeerR.start(); } catch(e) { console.error(e); }
        }

        function timStopPeerMic() {
            _timPeerOn = false;
            if (_timPeerR) { try { _timPeerR.stop(); _timPeerR.abort(); } catch(e) {} }
            _timPeerR = null;
            _timPeerBtnUI(false);
            _timPeerS('● 대기 중');
            _timSetInterim('');
        }

        function timToggleMyMic()   { _timMyOn   ? timStopMyMic()   : timStartMyMic(); }
        function timTogglePeerMic() { _timPeerOn ? timStopPeerMic() : timStartPeerMic(); }

        // ── 마이크 버튼 UI ───────────────────────────────────────────────
        function _timMyBtnUI(on) {
            var btn = document.getElementById('tim-my-btn');
            var ico = document.getElementById('tim-my-mic-icon');
            if (!btn) return;
            if (on) {
                btn.style.background = '#3b82f6'; btn.style.borderColor = '#1d4ed8';
                if (ico) { ico.style.background = '#1d4ed8'; ico.textContent = '⏹'; }
            } else {
                btn.style.background = '#eff6ff'; btn.style.borderColor = '#3b82f6';
                if (ico) { ico.style.background = '#dbeafe'; ico.textContent = '🎙️'; }
            }
        }
        function _timPeerBtnUI(on) {
            var btn = document.getElementById('tim-peer-btn');
            var ico = document.getElementById('tim-peer-mic-icon');
            if (!btn) return;
            if (on) {
                btn.style.background = '#10b981'; btn.style.borderColor = '#059669';
                if (ico) { ico.style.background = '#059669'; ico.textContent = '⏹'; }
            } else {
                btn.style.background = '#f0fdf4'; btn.style.borderColor = '#10b981';
                if (ico) { ico.style.background = '#d1fae5'; ico.textContent = '🎙️'; }
            }
        }

        // ── 대화 버블 렌더링 + 자동 TTS ─────────────────────────────────
        function _timAddBubble(side, original, translated, ttsLang) {
            var log = document.getElementById('tim-interp-log');
            if (!log) return;

            var placeholder = log.querySelector('div[style*="text-align:center"]');
            if (placeholder) placeholder.remove();

            var isMe   = (side === 'my');
            var color  = isMe ? '#3b82f6'  : '#10b981';
            var bgOrig = isMe ? '#eff6ff'  : '#f0fdf4';
            var bgTrans= isMe ? '#dbeafe'  : '#d1fae5';
            var flag   = isMe ? timSrc.f   : timTgt.f;
            var flagDst= isMe ? timTgt.f   : timSrc.f;
            var align  = isMe ? 'flex-end' : 'flex-start';
            var r1 = isMe ? '14px 14px 4px 14px'  : '14px 14px 14px 4px';
            var r2 = isMe ? '4px 14px 14px 14px'  : '14px 4px 14px 14px';

            var bubble = document.createElement('div');
            bubble.style.cssText = 'display:flex;flex-direction:column;align-items:' + align + ';gap:3px;margin-bottom:12px;animation:fadeIn 0.2s ease-out;';
            bubble.innerHTML =
                '<div style="font-size:9px;font-weight:800;color:' + color + ';letter-spacing:.4px;">' + flag + ' ' + (isMe ? timSrc.n : timTgt.n) + '</div>' +
                '<div style="max-width:90%;background:' + bgOrig + ';border-radius:' + r1 + ';padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
                    '<div style="font-size:13px;color:#1e293b;line-height:1.5;">' + escHtml(original) + '</div>' +
                '</div>' +
                '<div style="max-width:90%;background:' + bgTrans + ';border-radius:' + r2 + ';padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
                    '<div style="font-size:12px;color:' + color + ';font-weight:700;line-height:1.5;flex:1;">' + flagDst + ' ' + escHtml(translated) + '</div>' +
                    '<button data-tts="' + escHtml(translated) + '" data-lang="' + ttsLang + '" onclick="timSpeakLang(this.dataset.tts,this.dataset.lang)" ' +
                        'style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,0.8);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">🔊</button>' +
                '</div>';

            log.appendChild(bubble);
            log.scrollTop = log.scrollHeight;

            var hidEl = document.getElementById(isMe ? 'tim-log-my' : 'tim-log-peer');
            if (hidEl) hidEl.value += (hidEl.value ? '\n' : '') + original + '\n[→] ' + translated;

            // ★ 즉시 자동 TTS 발화
            timSpeakLang(translated, ttsLang);
        }

        // ── 인식 중 텍스트 ───────────────────────────────────────────────
        function _timSetInterim(text) {
            var el = document.getElementById('tim-interp-interim');
            if (!el) return;
            if (text) { el.textContent = text; el.style.display = 'block'; }
            else      { el.textContent = '';   el.style.display = 'none';  }
        }

        // ── AI 번역 → 버블 ───────────────────────────────────────────────
        async function _timTrBubble(text, side, fromN, toN, toG, toSr) {
            try {
                var prompt = fromN + '→' + toN + '(' + toG + ') 번역. 1줄만. 입력: ' + text;
                var tr = await timCallAI('interpret', prompt);
                if (tr) {
                    tr = tr.trim();
                    _timAddBubble(side, text, tr, toSr);
                }
                if (side === 'my')  _timMyS('● 대기 중');
                else                _timPeerS('● 대기 중');
            } catch(e) {
                console.warn('[_timTrBubble]', e.message);
                if (side === 'my')  _timMyS('● 대기 중');
                else                _timPeerS('● 대기 중');
            }
        }

        function _timTrSpeak(text, fromN, toN, toG, toSr, logId, statusFn) {
            var side = logId === 'tim-log-peer' ? 'my' : 'peer';
            _timTrBubble(text, side, fromN, toN, toG, toSr);
        }
        function _timAppend(id, text) {
            var el = document.getElementById(id); if (!el) return;
            el.value = (el.value ? el.value + '\n' : '') + text; el.scrollTop = el.scrollHeight;
        }
        function _timMyS(m)   { var e = document.getElementById('tim-my-status');   if(e) e.textContent = m; }
        function _timMyI(m)   { _timSetInterim(m); }
        function _timPeerS(m) { var e = document.getElementById('tim-peer-status'); if(e) e.textContent = m; }
        function _timPeerI(m) { _timSetInterim(m); }

        function timClearInterpLog() {
            var log = document.getElementById('tim-interp-log');
            if (log) log.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:#cbd5e1;">마이크 버튼을 눌러 통역을 시작하세요</div>';
            var my = document.getElementById('tim-log-my'), pe = document.getElementById('tim-log-peer');
            if (my) my.value = ''; if (pe) pe.value = '';
        }

        // ── TTS — voices 프리캐시 + 즉시 발화 ──────────────────────────
        window._timVoices = [];
        if (window.speechSynthesis) {
            var _preload = window.speechSynthesis.getVoices();
            if (_preload && _preload.length) window._timVoices = _preload;
            window.speechSynthesis.onvoiceschanged = function() {
                window._timVoices = window.speechSynthesis.getVoices();
            };
        }

        function timSpeakLang(text, lang) {
            if (!text) return;
            try {
                window.speechSynthesis.cancel();
                var doSpeak = function() {
                    var u = new SpeechSynthesisUtterance(text);
                    u.lang = lang; u.rate = 0.90; u.pitch = 1.0;
                    var voices = window._timVoices.length ? window._timVoices : window.speechSynthesis.getVoices();
                    var lc = lang.toLowerCase();
                    var best = voices.find(function(v) { return v.lang.toLowerCase() === lc; }) ||
                               voices.find(function(v) { return v.lang.toLowerCase().indexOf(lc.split('-')[0]) === 0; });
                    if (best) u.voice = best;
                    u.onerror = function(e) { console.warn('[TTS]', e); };
                    window.speechSynthesis.speak(u);
                };
                var voices = window._timVoices.length ? window._timVoices : window.speechSynthesis.getVoices();
                if (voices && voices.length > 0) {
                    window._timVoices = voices;
                    doSpeak();
                } else {
                    window.speechSynthesis.onvoiceschanged = function() {
                        window._timVoices = window.speechSynthesis.getVoices();
                        window.speechSynthesis.onvoiceschanged = null;
                        doSpeak();
                    };
                }
            } catch(err) { console.error('[timSpeakLang]', err); }
        }

        window.addEventListener('load',function(){
            setTimeout(function(){
                var k=localStorage.getItem('timApiKey');
                if(k) _GCLOUD_KEY=k;
                timUpdateUI();
                // 언어 선택 모달 그리드 초기화
                var lg=document.getElementById('tim-lang-grid');
                if(lg) lg.innerHTML=TIM_L.map(function(l,i){
                    return '<div style="padding:14px 8px;border-radius:14px;border:1.5px solid #e2e8f0;background:white;cursor:pointer;text-align:center;" onclick="timPickLang('+i+')">'+
                           '<div style="font-size:28px;">'+l.f+'</div>'+
                           '<div style="font-size:11px;font-weight:700;color:#475569;margin-top:4px;">'+l.n+'</div></div>';
                }).join('');
            },600);
        });

