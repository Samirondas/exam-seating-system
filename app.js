/* Examination Seating Arrangement
 * Static frontend for GitHub Pages. Uses Google Identity Services + Google Sheets API.
 * Public values (OAuth Client ID) are identifiers, not secrets. Never put a client secret
 * or service-account private key in this file.
 */
const CONFIG = {
  GOOGLE_CLIENT_ID: "859984835247-mrusgkq3sr3284nb7d3ugl0ffd1407cu.apps.googleusercontent.com",
  SCOPES: "https://www.googleapis.com/auth/spreadsheets",
  API_BASE: "https://sheets.googleapis.com/v4/spreadsheets"
};

const HEADERS = {
  STUDENT_MASTER: ["Roll No","Student Name","Application No","Subject","Programme"],
  ROOM_MASTER: ["Room No","Capacity","Rows","Columns"],
  EXAM_MASTER: ["Exam Name","Semester","Exam Date","Session","Default Capacity"],
  SEATING_RESULT: ["Exam Name","Semester","Exam Date","Session","Roll No","Student Name","Application No","Subject","Programme","Room No","Row No","Column No","Seat No"]
};
let tokenClient = null;
let accessToken = "";
let students = [];
let rooms = [];
let results = [];
let spreadsheetId = "";
let tokenExpiry = 0;

const $ = id => document.getElementById(id);
function setMessage(id, message, type="") { const el=$(id); el.textContent=message; el.className="message "+type; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function normaliseHeader(v){return String(v||"").trim().toLowerCase().replace(/[\s_\-]+/g,"");}
function parseDelimitedLine(line, delimiter) {
  const out=[]; let cur="", quote=false;
  for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++;}else quote=!quote;}else if(c===delimiter&&!quote){out.push(cur.trim());cur="";}else cur+=c;}
  out.push(cur.trim()); return out;
}
function parseText(text) {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(!lines.length)return [];
  const delimiter=lines[0].includes("\t")?"\t":",";
  let rows=lines.map(l=>parseDelimitedLine(l,delimiter));
  const first=rows[0].map(normaliseHeader);
  const hasHeader=first.some(x=>["rollno","studentname","applicationno","subject","programme"].includes(x));
  if(hasHeader){
    const idx={roll:first.findIndex(x=>["rollno","roll","serialno"].includes(x)),name:first.findIndex(x=>["studentname","name"].includes(x)),app:first.findIndex(x=>["applicationno","applicationnumber","appno"].includes(x)),subject:first.findIndex(x=>["subject","papersubject"].includes(x)),programme:first.findIndex(x=>["programme","program","course"].includes(x))};
    rows=rows.slice(1).map(r=>({roll:r[idx.roll]??"",name:r[idx.name]??"",app:r[idx.app]??"",subject:r[idx.subject]??"",programme:r[idx.programme]??""}));
  } else rows=rows.map(r=>({roll:r[0]??"",name:r[1]??"",app:r[2]??"",subject:r[3]??"",programme:r[4]??""}));
  return rows.map(r=>({roll:String(r.roll||"").trim(),name:String(r.name||"").trim(),app:String(r.app||"").trim(),subject:String(r.subject||"").trim(),programme:String(r.programme||"").trim()})).filter(r=>r.roll||r.name);
}
function initAuth(){
  if(!window.google?.accounts?.oauth2){setTimeout(initAuth,250);return;}
  if(!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.includes("PASTE_")){
    $("authStatus").textContent="OAuth setup required";
    $("signInBtn").title="Add your Google OAuth Client ID in app.js";
    return;
  }
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:CONFIG.GOOGLE_CLIENT_ID,scope:CONFIG.SCOPES,callback:async resp=>{
    if(resp.error){$("authStatus").textContent="Sign-in failed";setMessage("sheetMessage",resp.error,"error");return;}
    accessToken=resp.access_token;tokenExpiry=Date.now()+Number(resp.expires_in||3600)*1000;
    $("authStatus").textContent="Google connected";$("signInBtn").classList.add("hidden");$("signOutBtn").classList.remove("hidden");
    $("createWorkbookBtn").disabled=false;$("connectSheetBtn").disabled=false;
    $("saveStudentsBtn").disabled=false;$("saveRoomsBtn").disabled=false;$("generateBtn").disabled=false;
    setMessage("sheetMessage","Google account connected. Create a new workbook or connect an existing one.","success");
    if(spreadsheetId) await connectWorkbook(spreadsheetId);
  }});
}
function signIn(){if(!tokenClient){initAuth();if(!tokenClient){setMessage("sheetMessage","OAuth Client ID সেট করে পেজটি আবার খুলুন।","error");return;}}tokenClient.requestAccessToken({prompt:"consent"});}
function signOut(){if(accessToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(accessToken,()=>{});accessToken="";tokenExpiry=0;$("authStatus").textContent="Not connected";$("signInBtn").classList.remove("hidden");$("signOutBtn").classList.add("hidden");["createWorkbookBtn","connectSheetBtn","saveStudentsBtn","saveRoomsBtn","generateBtn","saveResultBtn"].forEach(id=>$(id).disabled=true);setMessage("sheetMessage","Signed out. Local lists remain in this page.","");}
async function api(url, options={}) {
  if(!accessToken||Date.now()>tokenExpiry-30000)throw new Error("Google sign-in expired. Please sign in again.");
  const headers={...(options.headers||{}),Authorization:"Bearer "+accessToken};
  if(options.body)headers["Content-Type"]="application/json";
  const res=await fetch(url,{...options,headers});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error?.message||`Google API error (${res.status})`);
  return data;
}
function sheetsUrl(id,tail=""){return `${CONFIG.API_BASE}/${encodeURIComponent(id)}${tail}`;}
async function createWorkbook(){
  try{
    setMessage("sheetMessage","Creating workbook…");
    const body={properties:{title:"Examination Seating Arrangement Database"},sheets:Object.keys(HEADERS).map(title=>({properties:{title}}))};
    const data=await api(CONFIG.API_BASE,{method:"POST",body:JSON.stringify(body)});
    spreadsheetId=data.spreadsheetId;$("spreadsheetId").value=spreadsheetId;localStorage.setItem("examSeatingSpreadsheetId",spreadsheetId);
    await initialiseHeaders(spreadsheetId);showSheetLink();setMessage("sheetMessage","New Google Sheet created and configured successfully.","success");
  }catch(e){setMessage("sheetMessage",e.message,"error");}
}
async function initialiseHeaders(id){
  const data=[];
  for(const [sheet,headers] of Object.entries(HEADERS))data.push({range:`'${sheet}'!A1`,values:[headers]});
  await api(sheetsUrl(id,":values:batchUpdate"),{method:"POST",body:JSON.stringify({valueInputOption:"RAW",data})});
}
function showSheetLink(){const a=$("openSheetLink");a.href=`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;a.classList.remove("hidden");}
async function connectWorkbook(id){
  try{
    if(!id)throw new Error("Enter a Spreadsheet ID.");
    setMessage("sheetMessage","Connecting to spreadsheet…");
    const meta=await api(sheetsUrl(id));
    const available=new Set((meta.sheets||[]).map(s=>s.properties.title));
    const missing=Object.keys(HEADERS).filter(s=>!available.has(s));
    if(missing.length)throw new Error("These tabs are missing: "+missing.join(", ")+". Create a new workbook with this app, or add the tabs manually.");
    spreadsheetId=id;$("spreadsheetId").value=id;localStorage.setItem("examSeatingSpreadsheetId",id);showSheetLink();
    setMessage("sheetMessage",`Connected: ${meta.properties?.title||"Google Sheet"}. Loading saved lists…`,"success");
    await loadStudents();await loadRooms();
  }catch(e){setMessage("sheetMessage",e.message,"error");}
}
async function getValues(range){const d=await api(sheetsUrl(spreadsheetId,`/values/${encodeURIComponent(range)}`));return d.values||[];}
async function writeValues(data){return api(sheetsUrl(spreadsheetId,":values:batchUpdate"),{method:"POST",body:JSON.stringify({valueInputOption:"RAW",data})});}
async function clearValues(range){return api(sheetsUrl(spreadsheetId,`/values/${encodeURIComponent(range)}:clear`),{method:"POST",body:JSON.stringify({})});}
function parseStudentsRows(rows){return rows.slice(1).filter(r=>r.some(x=>String(x??"").trim())).map(r=>({roll:String(r[0]??""),name:String(r[1]??""),app:String(r[2]??""),subject:String(r[3]??""),programme:String(r[4]??"")}));}
async function loadStudents(){const rows=await getValues("'STUDENT_MASTER'!A:E");students=parseStudentsRows(rows);renderStudents();}
async function loadRooms(){const rows=await getValues("'ROOM_MASTER'!A:D");rooms=rows.slice(1).filter(r=>r[0]).map(r=>({room:String(r[0]),capacity:Math.max(1,Number(r[1])||Number($("defaultCapacity").value)||30),rows:Math.max(1,Number(r[2])||0),cols:Math.max(1,Number(r[3])||0)}));renderRooms();}
async function saveStudents(){
  if(!spreadsheetId)throw new Error("Create or connect a Google Sheet first.");
  await clearValues("'STUDENT_MASTER'!A:E");
  const data=[{range:"'STUDENT_MASTER'!A1:E",values:[HEADERS.STUDENT_MASTER,...students.map(s=>[s.roll,s.name,s.app,s.subject,s.programme])]}];
  await writeValues(data);setMessage("sheetMessage",`${students.length} students saved to STUDENT_MASTER.`,"success");
}
async function saveRooms(){
  if(!spreadsheetId)throw new Error("Create or connect a Google Sheet first.");
  await clearValues("'ROOM_MASTER'!A:D");
  const data=[{range:"'ROOM_MASTER'!A1:D",values:[HEADERS.ROOM_MASTER,...rooms.map(r=>[r.room,r.capacity,r.rows||"",r.cols||""])]}];
  await writeValues(data);setMessage("sheetMessage",`${rooms.length} rooms saved to ROOM_MASTER.`,"success");
}
function renderStudents(){
  $("studentCount").textContent=`${students.length} students`;
  const body=$("studentTableBody");if(!students.length){body.innerHTML='<tr><td colspan="5" class="empty">No student data loaded.</td></tr>';return;}
  body.innerHTML=students.slice(0,300).map(s=>`<tr><td>${escapeHtml(s.roll)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.app)}</td><td>${escapeHtml(s.subject)}</td><td>${escapeHtml(s.programme)}</td></tr>`).join("");
  if(students.length>300)body.insertAdjacentHTML("beforeend",`<tr><td colspan="5" class="empty">Showing first 300 of ${students.length} students. All rows remain loaded.</td></tr>`);
}
function renderRooms(){
  $("roomCount").textContent=`${rooms.length} rooms`;
  const body=$("roomTableBody");if(!rooms.length){body.innerHTML='<tr><td colspan="4" class="empty">No rooms configured.</td></tr>';updateRoomFilter();return;}
  body.innerHTML=rooms.map(r=>`<tr><td>${escapeHtml(r.room)}</td><td>${r.capacity}</td><td>${r.rows||"Auto"}</td><td>${r.cols||"Auto"}</td></tr>`).join("");updateRoomFilter();
}
function updateRoomFilter(){const sel=$("roomFilter"),old=sel.value;sel.innerHTML='<option value="">All rooms</option>'+rooms.map(r=>`<option value="${escapeHtml(r.room)}">${escapeHtml(r.room)}</option>`).join("");if([...sel.options].some(o=>o.value===old))sel.value=old;}
function importPastedStudents(){
  const parsed=parseText($("studentPaste").value);if(!parsed.length){setMessage("generateMessage","No valid student rows found.","error");return;}
  const seen=new Set(students.map(s=>s.roll));let added=0;
  parsed.forEach(s=>{if(!s.roll){s.roll=s.app||`TEMP${students.length+1}`;}const key=s.roll.toLowerCase();if(!seen.has(key)){students.push(s);seen.add(key);added++;}});
  renderStudents();setMessage("generateMessage",`${added} new students imported. Duplicate Roll No values were skipped.`,`success`);
}
function importCsv(file){
  const reader=new FileReader();reader.onload=()=>{const parsed=parseText(String(reader.result||""));if(!parsed.length){setMessage("generateMessage","CSV file is empty or could not be read.","error");return;}students=parsed;renderStudents();setMessage("generateMessage",`${students.length} students loaded from CSV. Check the columns before saving.`,"success");};reader.readAsText(file);
}
function addDefaultRooms(){
  const cap=Math.max(1,Number($("defaultCapacity").value)||30);
  const needed=Math.ceil(students.length/cap);if(!students.length){setMessage("generateMessage","Load student data first, then create rooms.","error");return;}
  rooms=Array.from({length:needed},(_,i)=>({room:String(101+i),capacity:cap,rows:0,cols:0}));renderRooms();
}
function roomSort(a,b){return String(a.room).localeCompare(String(b.room),undefined,{numeric:true,sensitivity:"base"});}
function sortStudents(list){
  const mode=$("sortOrder").value;
  return [...list].sort((a,b)=>{
    if(mode==="name")return a.name.localeCompare(b.name,undefined,{sensitivity:"base"});
    if(mode==="application")return a.app.localeCompare(b.app,undefined,{numeric:true,sensitivity:"base"});
    return a.roll.localeCompare(b.roll,undefined,{numeric:true,sensitivity:"base"});
  });
}
function generateSeating(){
  if(!students.length){setMessage("generateMessage","Please import student data first.","error");return;}
  if(!rooms.length){setMessage("generateMessage","Please add at least one room.","error");return;}
  const sorted=sortStudents(students);const sortedRooms=[...rooms].sort(roomSort);
  const totalCapacity=sortedRooms.reduce((n,r)=>n+r.capacity,0);
  if(totalCapacity<sorted.length){setMessage("generateMessage",`Room capacity is ${totalCapacity}, but there are ${sorted.length} students. Add rooms or increase capacity.`,"error");return;}
  const exam={name:$("examName").value.trim()||"Examination",semester:$("semester").value.trim(),date:$("examDate").value,session:$("session").value};
  const next=[];let idx=0;
  for(const room of sortedRooms){
    const capacity=room.capacity;
    const rows=Math.max(1,Number(room.rows)||Math.ceil(Math.sqrt(capacity)));
    const cols=Math.max(1,Number(room.cols)||Math.ceil(capacity/rows));
    for(let seat=0;seat<capacity&&idx<sorted.length;seat++,idx++){
      const s=sorted[idx];const row=Math.floor(seat/cols)+1;const col=(seat%cols)+1;
      next.push({...s,examName:exam.name,semester:exam.semester,examDate:exam.date,session:exam.session,room:room.room,row,col,seatNo:seat+1});
    }
  }
  results=next;$("resultCount").textContent=`${results.length} assigned`;$("saveResultBtn").disabled=!spreadsheetId;$("printBtn").disabled=false;
  setMessage("generateMessage",`Generated ${results.length} seat assignments across ${new Set(results.map(r=>r.room)).size} rooms.`,"success");
  renderResults();
}
async function saveResult(){
  if(!spreadsheetId)throw new Error("Create or connect a Google Sheet first.");
  const values=[HEADERS.SEATING_RESULT,...results.map(r=>[r.examName,r.semester,r.examDate,r.session,r.roll,r.name,r.app,r.subject,r.programme,r.room,r.row,r.col,r.seatNo])];
  await clearValues("'SEATING_RESULT'!A:M");
  await writeValues([{range:"'SEATING_RESULT'!A1:M",values}]);
  await clearValues("'EXAM_MASTER'!A:E");
  await writeValues([{range:"'EXAM_MASTER'!A1:E",values:[HEADERS.EXAM_MASTER,[$("examName").value,$("semester").value,$("examDate").value,$("session").value,$("defaultCapacity").value]]}]);
  setMessage("generateMessage",`${results.length} assignments saved to SEATING_RESULT.`,"success");
}
function renderResults(){
  const q=$("searchInput").value.trim().toLowerCase(),room=$("roomFilter").value;
  const filtered=results.filter(r=>(!room||r.room===room)&&(!q||[r.roll,r.name,r.app,r.subject,r.programme,r.room].some(x=>String(x||"").toLowerCase().includes(q))));
  const roomCount=new Set(results.map(r=>r.room)).size;
  $("resultSummary").innerHTML=`<span>${results.length} students assigned</span><span>${roomCount} rooms used</span><span>${students.length-results.length} unassigned</span><span>Showing ${filtered.length}</span>`;
  if(!filtered.length){$("resultsContainer").innerHTML='<p class="empty">No matching students. Try a different search.</p>';return;}
  const groups=new Map();filtered.forEach(r=>{if(!groups.has(r.room))groups.set(r.room,[]);groups.get(r.room).push(r);});
  const roomMap=new Map(rooms.map(r=>[r.room,r]));
  $("resultsContainer").innerHTML=[...groups.entries()].sort((a,b)=>roomSort({room:a[0]},{room:b[0]})).map(([room,items])=>{
    const rm=roomMap.get(room)||{capacity:items.length,rows:0,cols:0};
    const rows=Math.max(1,Number(rm.rows)||Math.ceil(Math.sqrt(rm.capacity))),cols=Math.max(1,Number(rm.cols)||Math.ceil(rm.capacity/rows));
    const maxSeat=rm.capacity||items.length;const seatMap=new Map(items.map(x=>[x.seatNo,x]));
    const grid=Array.from({length:maxSeat},(_,i)=>{const s=seatMap.get(i+1);return s?`<div class="seat"><strong>Seat ${s.seatNo} · ${s.row}-${s.col}</strong><span>${escapeHtml(s.roll)}</span><small>${escapeHtml(s.name)}</small></div>`:`<div class="seat empty-seat"><strong>Seat ${i+1}</strong><span>—</span></div>`;}).join("");
    const list=items.slice().sort((a,b)=>a.seatNo-b.seatNo).map(s=>`<tr><td>${s.seatNo}</td><td>${escapeHtml(s.roll)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.app)}</td><td>${escapeHtml(s.subject)}</td><td>${s.row}</td><td>${s.col}</td></tr>`).join("");
    return `<article class="room-card"><div class="room-head"><div><h3>Room ${escapeHtml(room)}</h3><small>${escapeHtml($("examName").value)} · ${escapeHtml($("semester").value)} · ${escapeHtml($("examDate").value||"Date not set")}</small></div><strong>${items.length} / ${rm.capacity} students</strong></div><div class="matrix-wrap"><div class="seat-grid" style="grid-template-columns:repeat(${cols},minmax(100px,1fr))">${grid}</div></div><div class="room-list"><h4>Room-wise student list</h4><div class="table-wrap"><table><thead><tr><th>Seat</th><th>Roll No</th><th>Student Name</th><th>Application No</th><th>Subject</th><th>Row</th><th>Column</th></tr></thead><tbody>${list}</tbody></table></div></div></article>`;
  }).join("");
}
function safeRun(fn){return async()=>{try{await fn();}catch(e){setMessage("sheetMessage",e.message||String(e),"error");}};}
$("signInBtn").addEventListener("click",signIn);$("signOutBtn").addEventListener("click",signOut);
$("createWorkbookBtn").addEventListener("click",safeRun(createWorkbook));
$("connectSheetBtn").addEventListener("click",safeRun(()=>connectWorkbook($("spreadsheetId").value.trim())));
$("csvFile").addEventListener("change",e=>{if(e.target.files[0])importCsv(e.target.files[0]);});
$("importPasteBtn").addEventListener("click",importPastedStudents);
$("sampleStudentsBtn").addEventListener("click",()=>{students=[{roll:"0001",name:"Sample Student One",app:"APP001",subject:"Bengali",programme:"BA"},{roll:"0002",name:"Sample Student Two",app:"APP002",subject:"English",programme:"BA"},{roll:"0003",name:"Sample Student Three",app:"APP003",subject:"History",programme:"BA"},{roll:"0004",name:"Sample Student Four",app:"APP004",subject:"Bengali",programme:"BA"}];renderStudents();});
$("clearStudentsBtn").addEventListener("click",()=>{if(confirm("Clear the student list from this page? Google Sheets data will not be deleted until you save.")){students=[];renderStudents();}});
$("addDefaultRoomsBtn").addEventListener("click",addDefaultRooms);
$("saveStudentsBtn").addEventListener("click",safeRun(saveStudents));
$("saveRoomsBtn").addEventListener("click",safeRun(saveRooms));
$("generateBtn").addEventListener("click",generateSeating);
$("saveResultBtn").addEventListener("click",safeRun(saveResult));
$("printBtn").addEventListener("click",()=>window.print());
$("searchInput").addEventListener("input",renderResults);$("roomFilter").addEventListener("change",renderResults);
$("defaultCapacity").addEventListener("change",()=>{if(rooms.length===0)addDefaultRooms();});
const savedId=localStorage.getItem("examSeatingSpreadsheetId");if(savedId)$("spreadsheetId").value=savedId;
initAuth();
