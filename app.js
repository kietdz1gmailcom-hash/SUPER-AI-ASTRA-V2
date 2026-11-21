const $=id=>document.getElementById(id);
const workflow=[
["01","Tiếp nhận & phân tích","Đọc yêu cầu, ảnh và tài liệu; xác định mục tiêu, giới hạn và đầu ra."],
["02","Chọn AI chuyên môn","Đối chiếu năng lực và trạng thái API; không giao việc cho dịch vụ chưa kết nối."],
["03","Thực hiện theo thứ tự","Giao nhiệm vụ, nhận đầu ra và lưu trạng thái từng công đoạn."],
["04","Tích hợp sản phẩm","Kiểm tra định dạng, cấu trúc và sự tương thích giữa các thành phần."],
["05","Kiểm thử & tối ưu","Đối chiếu tiêu chí, ghi lỗi, yêu cầu sửa và kiểm thử lại."],
["06","Bàn giao","Cung cấp tệp/kết quả thực tế, nêu phần hoàn thành và phần còn chờ."]
];
let chosenFiles=[],currentJob=null,providers=[];
function show(view){["command","agents","workflow","history"].forEach(v=>$(v+"View").classList.toggle("hidden",v!==view));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===view));if(view==="history")loadHistory();}
document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>show(n.dataset.view)));
$("newJob").onclick=()=>{show("command");$("prompt").focus();$("jobPanel").classList.add("hidden");};
$("files").addEventListener("change",e=>{chosenFiles=[...e.target.files].slice(0,8);$("fileList").innerHTML=chosenFiles.map(f=>`<span class="file-chip">${escapeHtml(f.name)}</span>`).join("");});
$("dispatchMode").addEventListener("change",e=>$("manualAgents").classList.toggle("hidden",e.target.value!=="manual"));
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderProviders(){
 const icon={orchestrator:"◈",secondary:"◇",image:"▧",video:"▶",threeD:"⬡",audio:"♫"};
 const html=providers.map(p=>`<div class="provider"><div class="picon">${icon[p.id]||"✧"}</div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.state)}</small></div><span class="dot" style="background:${p.operational?"#57c78b":p.configured?"#d49a4d":"#754957"}"></span></div>`).join("");
 $("providerList").innerHTML=html;$("allProviders").innerHTML=providers.map(p=>`<div class="card agent-card"><div class="picon">${icon[p.id]||"✧"}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.purpose)}</p><div class="state">${escapeHtml(p.state)}</div></div>`).join("");
 $("providerCount").textContent=providers.length+" PROVIDERS";
}
function renderWorkflow(){ $("workflowLarge").innerHTML=workflow.map(x=>`<div class="workflow-row"><i>${x[0]}</i><span><b>${x[1]}</b><small>${x[2]}</small></span></div>`).join("");}
function renderJob(job){
 currentJob=job;$("jobPanel").classList.remove("hidden");
 const stages=job.stages.map(s=>`<div class="stage ${s.status==="completed"?"done":s.status==="blocked"?"blocked":s.status==="in_progress"?"current":""}"><b>${escapeHtml(s.name)}</b><small>${s.status==="completed"?"✓ Hoàn thành":s.status==="blocked"?"⚠ Đang chờ":s.status==="in_progress"?"● Đang thực hiện":"○ Chưa bắt đầu"}</small></div>`).join("");
 const agents=job.agents.map(a=>`<span>${escapeHtml(a.label)} · ${escapeHtml(a.reason)}</span>`).join("");
 $("jobPanel").innerHTML=`<div class="job-title"><div><div class="overline">TASK ORCHESTRATION · ${job.id.slice(0,8)}</div><h3>${escapeHtml(job.title)}</h3><small>${new Date(job.createdAt).toLocaleString("vi-VN")}</small></div><span class="job-status">${job.status==="waiting_for_api"?"CHỜ API":job.status==="review_required"?"CHỜ DUYỆT":"ĐANG XỬ LÝ"}</span></div><div class="stages">${stages}</div><div class="overline">NHÓM ĐƯỢC PHÂN CÔNG</div><div class="task-agents">${agents}</div><div class="overline">KẾT QUẢ ĐIỀU PHỐI</div><div class="answer">${escapeHtml(job.answer||"Chưa có kết quả.")}</div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="primary" id="copyResult">Sao chép kết quả</button><button class="primary" id="manualRefresh">Làm mới trạng thái</button></div>`;
 $("copyResult").onclick=()=>navigator.clipboard?.writeText(job.answer||"");
 $("manualRefresh").onclick=()=>refreshJob(job.id);
}
async function refreshJob(id){const r=await fetch("/api/jobs/"+id);if(r.ok)renderJob(await r.json());}
$("submit").addEventListener("click",async()=>{
 const prompt=$("prompt").value.trim();if(!prompt){$("prompt").focus();return;}
 const fd=new FormData();fd.append("prompt",prompt);fd.append("dispatchMode",$("dispatchMode").value);
 if($("dispatchMode").value==="manual"){const picks=[...$("manualAgents").querySelectorAll("input:checked")].map(x=>x.value);fd.append("manualAgents",JSON.stringify(picks));}
 chosenFiles.forEach(f=>fd.append("files",f));
 const btn=$("submit");btn.disabled=true;btn.textContent="ASTRA đang phân tích...";
 try{const r=await fetch("/api/jobs",{method:"POST",body:fd});const data=await r.json();if(!r.ok)throw new Error(data.error||"Không thể tạo nhiệm vụ.");renderJob(data);$("prompt").value="";chosenFiles=[];$("files").value="";$("fileList").innerHTML="";}catch(e){alert(e.message);}finally{btn.disabled=false;btn.textContent="Phân tích & phân công　➜";}
});
async function loadHistory(){const r=await fetch("/api/jobs");const jobs=await r.json();$("historyList").innerHTML=jobs.length?jobs.map(j=>`<div class="card history-item"><div><b>${escapeHtml(j.title)}</b><small>${new Date(j.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(j.status)}</small></div><button data-id="${j.id}">Mở nhiệm vụ</button></div>`).join(""):"<p class='notice'>Chưa có nhiệm vụ nào được lưu.</p>";document.querySelectorAll(".history-item button").forEach(b=>b.onclick=async()=>{const r=await fetch("/api/jobs/"+b.dataset.id);renderJob(await r.json());show("command");});}
async function init(){renderWorkflow();try{const r=await fetch("/api/status");const s=await r.json();providers=s.providers;renderProviders();const ok=s.orchestratorConfigured;$("healthText").textContent=ok?"AI điều phối đã cấu hình":"Chưa cấu hình API điều phối";$("topStatus").textContent=ok?"ORCHESTRATOR READY":"DEMO · API NOT CONFIGURED";$("healthDot").style.background=$("topDot").style.background=ok?"#57c78b":"#d49a4d";}catch{$("healthText").textContent="Không kết nối máy chủ";$("topStatus").textContent="SERVER OFFLINE";}}
init();
