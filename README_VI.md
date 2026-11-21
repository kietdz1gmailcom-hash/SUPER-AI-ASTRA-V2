# SUPER AI ASTRA ∞ V2 — Web multi-agent starter

## Có trong V2
- Website responsive, giao diện đỏ/đen.
- Chat/task workspace và lịch sử nhiệm vụ lưu trên máy chủ.
- Chế độ AUTO (ASTRA tự phân loại nhóm chuyên môn) và MANUAL (người dùng tự chọn nhóm AI trước khi gửi nhiệm vụ).
- Trạng thái kết nối nhà cung cấp: chỉ báo đã cấu hình khi thấy API key.
- Tải tối đa 8 tệp, 15 MB/tệp.
- Đọc TXT, MD, CSV, JSON, PDF, DOCX, XLSX, XLS.
- Ảnh được gửi tới mô hình điều phối nếu mô hình endpoint hỗ trợ vision.
- ZIP được nhận diện nhưng không tự bung hoặc thực thi nội dung vì an toàn.
- Lưu job và 6 giai đoạn vào `data/jobs.json`.

## Chạy trên máy tính
1. Cài Node.js 18+.
2. Giải nén ZIP.
3. Mở Terminal/CMD trong thư mục dự án.
4. Chạy `npm install`.
5. Sao chép `.env.example` thành `.env`.
6. Thêm API key hợp lệ vào `OPENAI_API_KEY`; chọn `OPENAI_BASE_URL` và `OPENAI_MODEL` tương ứng nhà cung cấp tương thích.
7. Chạy `npm start`.
8. Mở `http://localhost:3000`.

## Chạy trên Android
Có thể dùng Termux nếu thiết bị hỗ trợ Node.js:
1. Cài Termux từ nguồn chính thức phù hợp.
2. Cài Node.js và giải nén dự án.
3. Chạy `npm install`, tạo `.env`, rồi `npm start`.
4. Mở `http://127.0.0.1:3000` trong trình duyệt cùng điện thoại.
Các bước có thể khác theo phiên bản Android/Termux. Không đưa API key vào ảnh chụp màn hình hoặc chia sẻ công khai.

## Sự thật về mức tích hợp
V2 thực sự gọi **một mô hình điều phối** qua API tương thích OpenAI khi `OPENAI_API_KEY` được cấu hình. Tùy model, ảnh có thể được phân tích bằng vision. Khóa `SECONDARY_API_KEY` hiện chỉ dành cho phần mở rộng đối chiếu; chưa tự động gọi AI thứ hai.
Các trường IMAGE_PROVIDER_API_KEY, VIDEO_PROVIDER_API_KEY, AUDIO_PROVIDER_API_KEY, THREE_D_PROVIDER_API_KEY chỉ thể hiện cấu hình có khóa. Chưa có adapter chạy tạo ảnh/video/âm thanh/3D. Muốn gọi từng nhà cung cấp phải viết adapter theo API/SDK chính thức của họ, xác thực đầu ra, quản lý hạn mức và chi phí. Không có API key thì ứng dụng chạy ở chế độ chờ API, không giả vờ đã tạo nội dung.
Đây là starter project; chưa có đăng nhập, phân quyền, database production, queue worker, billing, kiểm duyệt tải lên hoặc triển khai cloud. Không public server này lên internet trước khi bổ sung các lớp bảo mật đó.

## Kiến trúc
- `server.js`: API, đọc tệp, phân loại nhiệm vụ, lưu job, gọi model điều phối.
- `public/`: giao diện trình duyệt.
- `.env`: thông tin API bí mật (không commit).
- `data/jobs.json`: lịch sử job local.


## Triển khai trực tuyến bằng Render
1. Đưa toàn bộ nội dung thư mục dự án lên một GitHub repository riêng tư (Private). Không tải `.env`, `node_modules`, hoặc khóa API lên GitHub.
2. Đăng nhập Render và chọn **New → Web Service**.
3. Kết nối GitHub, chọn repository chứa dự án.
4. Thiết lập:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: Free để thử nghiệm, hoặc gói phù hợp khi vận hành lâu dài.
5. Trong **Environment**, thêm `OPENAI_API_KEY`, `OPENAI_MODEL`, và `OPENAI_BASE_URL` nếu đã có thông tin API hợp lệ. Không gửi khóa API cho người khác.
6. Chọn **Create Web Service**, chờ trạng thái deploy thành công, rồi mở URL `*.onrender.com`.
7. Kiểm tra `/api/status` và thử gửi một nhiệm vụ nhỏ.

Lưu ý: Render Free có thể tạm dừng dịch vụ sau thời gian không hoạt động và không có persistent disk. V2 hiện lưu lịch sử vào `data/jobs.json`, vì vậy lịch sử có thể mất khi dịch vụ khởi động lại hoặc deploy lại. Trước khi dùng thật, cần chuyển lịch sử sang database bền vững (ví dụ PostgreSQL) hoặc cấu hình persistent disk trên gói hỗ trợ và đổi đường dẫn lưu. Không đưa API key vào mã nguồn hoặc GitHub.
