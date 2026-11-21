require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/png","image/jpeg","image/webp","image/gif",
      "text/plain","text/markdown","text/csv","application/json",
      "application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel","application/zip","application/x-zip-compressed"
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = [".png",".jpg",".jpeg",".webp",".gif",".txt",".md",".csv",".json",".pdf",".docx",".xlsx",".xls",".zip"];
    if (allowed.has(file.mimetype) || allowedExt.includes(ext)) cb(null, true);
    else cb(new Error("Định dạng tệp chưa được hỗ trợ."));
  }
});
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const DATA_FILE = path.join(__dirname, "data", "jobs.json");
const providers = [
  { id:"orchestrator", name:"AI Tổng chỉ huy", kind:"chat", env:"OPENAI_API_KEY", modelEnv:"OPENAI_MODEL", baseEnv:"OPENAI_BASE_URL", purpose:"Phân tích, lập kế hoạch, tổng hợp và điều phối" },
  { id:"secondary", name:"AI Đối chiếu", kind:"chat", env:"SECONDARY_API_KEY", modelEnv:"SECONDARY_MODEL", baseEnv:"SECONDARY_BASE_URL", purpose:"Đánh giá độc lập và phản biện kết quả" },
  { id:"image", name:"AI Hình ảnh", kind:"image", env:"IMAGE_PROVIDER_API_KEY", purpose:"Tạo concept art, nhân vật, giao diện" },
  { id:"video", name:"AI Video", kind:"video", env:"VIDEO_PROVIDER_API_KEY", purpose:"Tạo video, cảnh phim và chuyển động" },
  { id:"threeD", name:"AI 3D", kind:"3d", env:"THREE_D_PROVIDER_API_KEY", purpose:"Mô hình, rig và hoạt ảnh 3D" },
  { id:"audio", name:"AI Âm thanh", kind:"audio", env:"AUDIO_PROVIDER_API_KEY", purpose:"Nhạc nền, âm thanh và giọng nói" }
];

function readJobs() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return []; }
}
function writeJobs(jobs) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive:true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs.slice(0,100), null, 2));
}
function clientFor(prefix="") {
  const key = process.env[prefix + "API_KEY"];
  if (!key) return null;
  const baseURL = process.env[prefix + "BASE_URL"];
  return new OpenAI({ apiKey:key, ...(baseURL ? {baseURL} : {}) });
}
function statusProviders() {
  return providers.map(p => {
    const connected = Boolean(process.env[p.env]);
    const chatReady = p.kind === "chat" && connected;
    return { id:p.id, name:p.name, purpose:p.purpose, kind:p.kind,
      configured:connected, operational:chatReady,
      state: chatReady ? "Sẵn sàng gọi API" : connected ? "Đã có khóa · cần adapter riêng" : "Chưa kết nối" };
  });
}
function assignAgents(prompt) {
  const p = prompt.toLowerCase();
  const has = (...terms) => terms.some(t => p.includes(t));
  const selected = [{id:"orchestrator",label:"Tổng chỉ huy",reason:"Phân tích và lập kế hoạch"}];
  if (has("code","lập trình","website","web","game","godot","app","ứng dụng","mã nguồn")) selected.push({id:"code",label:"Lập trình",reason:"Xây dựng logic và tích hợp"});
  if (has("ảnh","hình ảnh","nhân vật","thiết kế","logo","poster","concept")) selected.push({id:"image",label:"Hình ảnh",reason:"Thiết kế hình ảnh và concept"});
  if (has("video","phim","clip","cinematic")) selected.push({id:"video",label:"Video",reason:"Tạo hoặc dựng chuyển động"});
  if (has("3d","mô hình","model","rig","animation","hoạt ảnh")) selected.push({id:"threeD",label:"3D & hoạt hình",reason:"Mô hình và chuyển động"});
  if (has("hiệu ứng","vfx","skill","kỹ năng","ánh sáng")) selected.push({id:"vfx",label:"Hiệu ứng",reason:"Thiết kế hiệu ứng hình ảnh"});
  if (has("nhạc","âm nhạc","âm thanh","sound","giọng nói","lồng tiếng","voice")) selected.push({id:"audio",label:"Âm thanh & giọng nói",reason:"Âm nhạc và thiết kế âm thanh"});
  selected.push({id:"qa",label:"Kiểm thử",reason:"Đối chiếu yêu cầu và phát hiện thiếu sót"});
  return selected;
}
async function extractFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if ([".txt",".md",".csv",".json"].includes(ext)) return file.buffer.toString("utf8").slice(0,40000);
  if (ext === ".pdf") {
    const parsed = await pdfParse(file.buffer);
    return (parsed.text || "").slice(0,40000);
  }
  if (ext === ".docx") {
    const parsed = await mammoth.extractRawText({buffer:file.buffer});
    return (parsed.value || "").slice(0,40000);
  }
  if ([".xlsx",".xls"].includes(ext)) {
    const wb = XLSX.read(file.buffer, {type:"buffer"});
    return wb.SheetNames.map(n => `Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n").slice(0,40000);
  }
  if (ext === ".zip") return "[Tệp ZIP đã nhận. Vì lý do an toàn, bản V2 không tự giải nén hoặc thực thi nội dung ZIP. Hãy giải nén cục bộ và đính kèm các tệp cần phân tích.]";
  return null;
}
function buildSystemPrompt() {
  return `Bạn là SUPER AI ASTRA ∞ V2, AI tổng chỉ huy. Trả lời bằng tiếng Việt.
Luôn trung thực về công cụ: chỉ nói đã gọi một dịch vụ bên ngoài nếu máy chủ thực sự gọi API dịch vụ đó.
Bạn có thể lập kế hoạch và soạn đầu ra văn bản; không tự nhận đã tạo tệp ảnh/video/3D nếu không có adapter tương ứng.
Trình bày theo mục: 1. Phân tích 2. Phân công (người chịu trách nhiệm, đầu vào, đầu ra, tiêu chí nghiệm thu, người nhận tiếp) 3. Thực hiện 4. Kiểm tra 5. Bàn giao.
Phân biệt rõ: đã thực hiện, đề xuất, đang chờ tích hợp API.`;
}
app.get("/api/status", (_req,res) => res.json({
  app:"SUPER AI ASTRA ∞", version:"2.0.0",
  orchestratorConfigured:Boolean(process.env.OPENAI_API_KEY),
  providers:statusProviders(),
  capabilities:{chat:Boolean(process.env.OPENAI_API_KEY), vision:Boolean(process.env.OPENAI_API_KEY), fileRead:["TXT","MD","CSV","JSON","PDF","DOCX","XLSX","XLS"], imageGeneration:false, videoGeneration:false, threeDGeneration:false, audioGeneration:false},
  note:"Các nhà cung cấp chuyên dụng cần adapter API riêng; chỉ cấu hình khóa không tự làm cho dịch vụ hoạt động."
}));
app.get("/api/jobs", (_req,res) => res.json(readJobs().map(({id,title,status,createdAt,agents})=>({id,title,status,createdAt,agents}))));
app.get("/api/jobs/:id", (req,res) => {
  const job = readJobs().find(j=>j.id===req.params.id);
  if (!job) return res.status(404).json({error:"Không tìm thấy nhiệm vụ."});
  res.json(job);
});
app.delete("/api/jobs/:id", (req,res) => {
  const jobs=readJobs().filter(j=>j.id!==req.params.id); writeJobs(jobs); res.json({ok:true});
});

app.post("/api/jobs", upload.array("files",8), async (req,res) => {
  const prompt=(req.body.prompt||"").trim();
  if(!prompt) return res.status(400).json({error:"Hãy nhập yêu cầu."});
  try {
    const attachments=[];
    const imageParts=[];
    for(const f of (req.files||[])){
      const ext=path.extname(f.originalname).toLowerCase();
      const text=await extractFile(f);
      if(text!==null) attachments.push({name:f.originalname,type:"text",content:text});
      else if(f.mimetype.startsWith("image/")) {
        attachments.push({name:f.originalname,type:"image",content:"Ảnh được đính kèm cho mô hình có khả năng nhìn ảnh."});
        imageParts.push({type:"image_url",image_url:{url:`data:${f.mimetype};base64,${f.buffer.toString("base64")}`,detail:"high"}});
      } else attachments.push({name:f.originalname,type:"unsupported",content:"Đã nhận nhưng chưa đọc được định dạng này."});
    }
    const dispatchMode = req.body.dispatchMode === "manual" ? "manual" : "auto";
    let agents = assignAgents(prompt);
    if (dispatchMode === "manual") {
      const allowed = new Set(["code","image","video","threeD","vfx","audio","qa"]);
      let requested = [];
      try { requested = JSON.parse(req.body.manualAgents || "[]"); } catch {}
      requested = [...new Set(requested.filter(id => allowed.has(id)))];
      const labels = {code:"Lập trình",image:"Hình ảnh",video:"Video",threeD:"3D & hoạt hình",vfx:"Hiệu ứng",audio:"Âm thanh & giọng nói",qa:"Kiểm thử"};
      if (!requested.length) return res.status(400).json({error:"Hãy chọn ít nhất một nhóm AI trong chế độ thủ công."});
      agents = [{id:"orchestrator",label:"Tổng chỉ huy",reason:"Tiếp nhận và điều phối theo lựa chọn của bạn"},
        ...requested.map(id=>({id,label:labels[id],reason:"Được người dùng chọn thủ công"}))];
      if (!requested.includes("qa")) agents.push({id:"qa",label:"Kiểm thử",reason:"Bước kiểm tra chất lượng mặc định"});
    }
    const id=crypto.randomUUID();
    const job={id,title:prompt.slice(0,90),prompt,status:"planning",createdAt:new Date().toISOString(),
      stages:[
        {id:"intake",name:"Tiếp nhận & phân tích",status:"completed"},
        {id:"routing",name:"Chọn AI chuyên môn",status:"completed"},
        {id:"execution",name:"Thực hiện nhiệm vụ",status:"in_progress"},
        {id:"integration",name:"Tích hợp sản phẩm",status:"pending"},
        {id:"qa",name:"Kiểm thử & tối ưu",status:"pending"},
        {id:"delivery",name:"Bàn giao",status:"pending"}
      ],
      agents,dispatchMode,attachments,deliverables:[],answer:""};
    const client=clientFor("OPENAI_");
    if(!client){
      job.status="waiting_for_api";
      job.answer="ASTRA đã tạo kế hoạch và phân công sơ bộ. Chưa có OPENAI_API_KEY nên chưa thể gọi mô hình điều phối. Hãy cấu hình .env theo README. Các AI tạo ảnh/video/3D/âm thanh vẫn cần adapter API riêng.";
      job.stages[2].status="blocked";
      job.stages[2].note="Chờ cấu hình API điều phối";
    } else {
      const fileText=attachments.filter(a=>a.type==="text"||a.type==="unsupported").map(a=>`Tệp ${a.name}:\n${a.content}`).join("\n\n");
      const userContent=[{type:"text",text:`YÊU CẦU:\n${prompt}\n\nCÁC NHÓM ĐƯỢC ĐỀ XUẤT:\n${JSON.stringify(agents,null,2)}\n\nTỆP ĐÍNH KÈM:\n${fileText||"Không có văn bản trích xuất."}`} ,...imageParts];
      const completion=await client.chat.completions.create({
        model:process.env.OPENAI_MODEL||"gpt-4.1-mini",
        messages:[{role:"system",content:buildSystemPrompt()},{role:"user",content:userContent}],
        temperature:0.4
      });
      job.answer=completion.choices?.[0]?.message?.content||"Không nhận được nội dung phản hồi.";
      job.status="review_required";
      job.stages[2].status="completed";
      job.stages[2].note="Đã nhận phản hồi từ mô hình điều phối";
      job.stages[3].status="blocked";
      job.stages[3].note="Chưa có adapter tạo/tích hợp tài nguyên chuyên dụng";
      job.stages[4].status="pending";
      job.deliverables=[{type:"text",name:"Kế hoạch và phân công",status:"created"}];
    }
    const jobs=readJobs(); jobs.unshift(job); writeJobs(jobs);
    res.json(job);
  }catch(err){
    console.error(err);
    res.status(500).json({error:err.message||"Lỗi xử lý nhiệm vụ."});
  }
});

app.use((err,_req,res,_next)=>{
  if(err instanceof multer.MulterError) return res.status(400).json({error:err.code==="LIMIT_FILE_SIZE"?"Tệp vượt quá giới hạn 15 MB.":"Quá số lượng tệp cho phép."});
  res.status(400).json({error:err.message||"Yêu cầu không hợp lệ."});
});
const port=Number(process.env.PORT||3000);
app.listen(port, "0.0.0.0", ()=>console.log(`SUPER AI ASTRA ∞ V2 running on port ${port}`));
