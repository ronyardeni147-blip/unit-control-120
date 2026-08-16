import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
import html2canvas from 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm';

const SUPABASE_URL = 'https://zazbtggysxgjwagdmlee.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Q52BM6ZWncHyqF_U3SwC2w_AiZ1DKNn';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const prepared = new Map();
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtDate = (v) => v ? new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—';
function toast(text){ const el=document.querySelector('#toast'); if(!el)return; el.textContent=text; el.classList.add('show'); clearTimeout(window.__waToast); window.__waToast=setTimeout(()=>el.classList.remove('show'),3200); }
function normalizePhone(phone=''){ let p=String(phone).replace(/\D/g,''); if(p.startsWith('0'))p=`972${p.slice(1)}`; return p; }
function downloadBlob(blob,name){ const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000); }
function supportsFileShare(file){ try{return !!navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}));}catch{return false;} }
function restore(btn){ if(!btn)return;btn.disabled=false;btn.textContent='PDF ל‑WhatsApp';delete btn.dataset.waReady; }
async function waitForImages(stage){ await document.fonts.ready; await Promise.all([...stage.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(res=>{img.onload=img.onerror=res;}))); }
async function stageToPdf(stage){
  const canvas=await html2canvas(stage,{scale:2,backgroundColor:'#fff',useCORS:true});
  const pdf=new jsPDF({unit:'pt',format:'a4'}),pageW=555,pageH=802,pxPage=Math.floor(canvas.width*(pageH/pageW));
  let y=0,page=0;
  while(y<canvas.height){const slice=Math.min(pxPage,canvas.height-y),c=document.createElement('canvas');c.width=canvas.width;c.height=slice;c.getContext('2d').drawImage(canvas,0,y,canvas.width,slice,0,0,canvas.width,slice);if(page++)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.92),'JPEG',20,20,pageW,slice*(pageW/canvas.width));y+=slice;}
  return pdf;
}
function arm(key,btn,{blob,file,title,text,phone}){
  const p=normalizePhone(phone); const waUrl=p?`https://wa.me/${p}?text=${encodeURIComponent(text)}`:'';
  if(supportsFileShare(file)){
    prepared.set(key,{mode:'share',blob,file,title,text,waUrl});
    btn.disabled=false;btn.textContent='שתף עכשיו ב‑WhatsApp';btn.dataset.waReady=key;
    toast('ה‑PDF מוכן. לחץ שוב כדי לשתף את הקובץ');
  }else{
    downloadBlob(blob,file.name);
    if(waUrl){prepared.set(key,{mode:'wa',blob,file,title,text,waUrl});btn.disabled=false;btn.textContent='פתח WhatsApp';btn.dataset.waReady=key;toast('ה‑PDF הורד. לחץ שוב לפתיחת WhatsApp');}
    else{restore(btn);toast('ה‑PDF הורד. לא הוזן מספר WhatsApp');}
  }
}
async function usePrepared(key,btn){
  const x=prepared.get(key);if(!x)return false;
  if(x.mode==='share'){
    try{const p=navigator.share({title:x.title,text:x.text,files:[x.file]});await p;prepared.delete(key);restore(btn);toast('הקובץ הועבר למסך השיתוף');}
    catch(e){if(e?.name!=='AbortError'){downloadBlob(x.blob,x.file.name);x.mode=x.waUrl?'wa':'done';if(x.waUrl){btn.textContent='פתח WhatsApp';toast('השיתוף נחסם. ה‑PDF הורד; לחץ שוב לפתיחת WhatsApp');}else{prepared.delete(key);restore(btn);toast('ה‑PDF הורד למכשיר');}}}
    return true;
  }
  if(x.mode==='wa'){
    const w=window.open(x.waUrl,'_blank','noopener,noreferrer');if(!w)location.href=x.waUrl;prepared.delete(key);restore(btn);toast('WhatsApp נפתח. צרף את קובץ ה‑PDF שהורד');return true;
  }
  prepared.delete(key);restore(btn);return true;
}
async function buildQuestionnaire(id,btn){
  const key=`q:${id}`; if(await usePrepared(key,btn))return;
  btn.disabled=true;btn.textContent='מכין PDF...';
  try{
    const [sRes,aRes,pRes]=await Promise.all([
      supabase.from('uc_questionnaire_submissions').select('*,uc_questionnaire_templates(title,key)').eq('id',id).single(),
      supabase.from('uc_questionnaire_answers').select('*,uc_questionnaire_questions(question_text,sort_order)').eq('submission_id',id),
      supabase.from('uc_questionnaire_photos').select('*').eq('submission_id',id).order('sort_order')
    ]);
    if(sRes.error)throw sRes.error;if(aRes.error)throw aRes.error;if(pRes.error)throw pRes.error;
    const s=sRes.data,answers=(aRes.data||[]).sort((x,y)=>(x.uc_questionnaire_questions?.sort_order||0)-(y.uc_questionnaire_questions?.sort_order||0));
    const photos=[];for(const ph of pRes.data||[]){const {data}=await supabase.storage.from('uc-questionnaire-images').createSignedUrl(ph.storage_path,3600);photos.push({...ph,url:data?.signedUrl||''});}
    const stage=document.querySelector('#pdfStage');
    stage.innerHTML=`<div class="pdf-sheet"><div class="pdf-head"><div class="eyebrow">מערכת הבקרות היחידתית</div><h1>${esc(s.uc_questionnaire_templates?.title||'שאלון')}</h1><div>${fmtDate(s.performed_at)}</div></div><table class="pdf-table"><tr><td>שיוך</td><td>${esc(s.unit_assignment||'—')}</td></tr><tr><td>יחידה</td><td>${esc(s.unit_name||'—')}</td></tr><tr><td>מיקום</td><td>${esc(s.location_text||'—')}</td></tr><tr><td>חונך / מבקר</td><td>${esc(s.inspector_name||'—')}</td></tr><tr><td>איש קשר</td><td>${esc(s.contact_name||'—')}</td></tr></table><h2>ממצאים</h2>${answers.map((x,i)=>`<div class="pdf-q"><strong>${i+1}. ${esc(x.uc_questionnaire_questions?.question_text||'')}</strong><div>${x.checked?'✓ בוצע / תקין':'○ לא סומן'}</div>${x.comment?`<div>התייחסות: ${esc(x.comment)}</div>`:''}</div>`).join('')}<h2>סיכום</h2><div>${esc(s.summary||'—')}</div>${photos.length?`<h2>תמונות</h2><div class="pdf-photo-grid">${photos.map(x=>`<div class="pdf-photo"><img crossorigin="anonymous" src="${esc(x.url)}"><div>${esc(x.caption||'')}</div></div>`).join('')}</div>`:''}</div>`;
    await waitForImages(stage);const pdf=await stageToPdf(stage),blob=pdf.output('blob'),file=new File([blob],`questionnaire-${id}.pdf`,{type:'application/pdf'});
    const text=`מצורף ${s.uc_questionnaire_templates?.title||'שאלון'} עבור ${s.unit_name||s.unit_assignment||''}`;
    arm(key,btn,{blob,file,title:`${s.uc_questionnaire_templates?.title||'שאלון'} - ${s.unit_name||''}`,text,phone:s.contact_phone});
  }catch(e){console.error(e);restore(btn);toast('לא ניתן להפיק את ה‑PDF. נסה שוב');}
}
async function buildReport(id,btn){
  const key=`r:${id}`;if(await usePrepared(key,btn))return;
  btn.disabled=true;btn.textContent='מכין PDF...';
  try{
    const {data:r,error}=await supabase.from('uc_reports').select('*').eq('id',id).single();if(error)throw error;
    const details=Array.isArray(r.unit_details)?r.unit_details:[],stage=document.querySelector('#pdfStage');
    stage.innerHTML=`<div class="pdf-sheet"><div class="pdf-head"><div class="eyebrow">מערכת הבקרות היחידתית</div><h1>סיכום דוח</h1></div><table class="pdf-table"><tr><td>שם הדוח</td><td>${esc(r.title)}</td></tr><tr><td>סוג</td><td>${esc(r.report_type||'—')}</td></tr><tr><td>שיוך</td><td>${esc(r.unit_assignment||'—')}</td></tr><tr><td>תקופה</td><td>${esc(r.period_label||'—')}</td></tr><tr><td>יעד לטיפול</td><td>${fmtDate(r.due_at)}</td></tr><tr><td>איש קשר</td><td>${esc(r.contact_name||'—')}</td></tr><tr><td>סיכום</td><td>${esc(r.summary||'—')}</td></tr></table>${details.length?`<h2>פירוט לפי יחידות</h2>${details.map(d=>`<div class="pdf-unit"><strong>${esc(d.unit||'יחידה')}</strong><div>${esc(d.details||'')}</div></div>`).join('')}`:''}</div>`;
    const pdf=await stageToPdf(stage),blob=pdf.output('blob'),file=new File([blob],`report-${r.id}.pdf`,{type:'application/pdf'}),text=`מצורף סיכום הדוח: ${r.title}`;
    arm(key,btn,{blob,file,title:`דוח: ${r.title}`,text,phone:r.contact_phone});
  }catch(e){console.error(e);restore(btn);toast('לא ניתן להפיק את ה‑PDF. נסה שוב');}
}

document.addEventListener('click',(e)=>{
  const listQ=e.target.closest('[data-share-questionnaire]');
  const openQ=e.target.closest('#shareQuestionnaire');
  const report=e.target.closest('[data-report-share]');
  if(!listQ&&!openQ&&!report)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(report){buildReport(report.dataset.reportShare,report);return;}
  if(listQ){buildQuestionnaire(listQ.dataset.shareQuestionnaire,listQ);return;}
  if(openQ){
    const id=document.querySelector('input[name="submission_id"]')?.value;
    if(id){buildQuestionnaire(id,openQ);return;}
    const submit=document.querySelector('#submitQuestionnaire');
    if(submit){toast('השאלון יישמר כעת. לאחר השמירה לחץ שוב על PDF ל‑WhatsApp');submit.click();}
    else toast('יש לשמור את השאלון לפני השיתוף');
  }
},true);
