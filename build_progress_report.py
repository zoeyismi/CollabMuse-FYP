from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont


OUT = Path("FYP_Progress_Report_Completed_Zhang_Ziyi.docx")
ASSET_DIR = Path("progress_report_assets")
ASSET_DIR.mkdir(exist_ok=True)


PROJECT_TITLE = "Real-time Collaborative Music Composition Tool"
STUDENT_NAME = "Zhang Ziyi 张子怡"
STUDENT_ID = "P2323698"
PROJECT_NO = "12"
SUPERVISOR = "Franky Hoi Un Cheang"
SUBMISSION_DATE = "June 4, 2026"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_text(cell, text, bold=False, size=10, color=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(size)
    if color:
        r.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_table_borders(table, color="B7C0CC", size="6"):
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def style_table(table, header=True):
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.style = "Table Grid"
    set_table_borders(table)
    for i, row in enumerate(table.rows):
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9.5)
        if header and i == 0:
            for cell in row.cells:
                set_cell_shading(cell, "E8EEF5")
                for p in cell.paragraphs:
                    for r in p.runs:
                        r.bold = True


def add_caption(doc, text):
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.italic = True
    r.font.size = Pt(9)


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for r in p.runs:
        r.font.color.rgb = RGBColor(31, 78, 121)
    return p


def add_body(doc, text):
    p = doc.add_paragraph(text)
    p.style = "Normal"
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.08
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)
        p.paragraph_format.space_after = Pt(4)


def add_numbered(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.add_run(item)
        p.paragraph_format.space_after = Pt(4)


def get_font(size=22, bold=False):
    for name in ("Arial.ttf", "Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            pass
    return ImageFont.load_default()


def draw_pdm(path):
    img = Image.new("RGB", (1800, 760), "white")
    d = ImageDraw.Draw(img)
    font = get_font(30)
    small = get_font(22)
    boxes = [
        ("A1\nProject setup\nES 1 EF 2\nLS 1 LF 2", 70, 70),
        ("A2\nRequirements\nES 2 EF 3\nLS 2 LF 3", 420, 70),
        ("A3\nLiterature review\nES 2 EF 5\nLS 3 LF 6", 420, 360),
        ("A4\nArchitecture\nES 4 EF 5\nLS 4 LF 5", 760, 70),
        ("A5\nUI prototype\nES 5 EF 6\nLS 5 LF 6", 1100, 70),
        ("A6\nCore prototype\nES 6 EF 9\nLS 6 LF 9", 1440, 70),
        ("A7\nTesting/report\nES 9 EF 13\nLS 9 LF 13", 1100, 420),
    ]
    box_w, box_h = 270, 170
    for label, x, y in boxes:
        d.rounded_rectangle((x, y, x + box_w, y + box_h), radius=18, outline=(31, 78, 121), width=4, fill=(235, 242, 250))
        lines = label.split("\n")
        for idx, line in enumerate(lines):
            f = font if idx == 0 else small
            d.text((x + 18, y + 18 + idx * 34), line, font=f, fill=(20, 35, 50))
    def arrow(x1, y1, x2, y2):
        d.line((x1, y1, x2, y2), fill=(80, 90, 100), width=4)
        d.polygon([(x2, y2), (x2 - 18, y2 - 10), (x2 - 18, y2 + 10)], fill=(80, 90, 100))
    arrow(340, 155, 420, 155)
    arrow(690, 155, 760, 155)
    arrow(1030, 155, 1100, 155)
    arrow(1370, 155, 1440, 155)
    arrow(555, 240, 555, 360)
    arrow(690, 445, 1100, 505)
    arrow(1575, 240, 1250, 420)
    d.text((70, 660), "Critical path: A1 -> A2 -> A4 -> A5 -> A6 -> A7", font=font, fill=(160, 58, 45))
    img.save(path)


def draw_gantt(path):
    tasks = [
        ("A1 Setup", 1, 2), ("A2 Requirements", 1, 3), ("A3 Literature", 1, 5),
        ("A4 Architecture", 4, 5), ("A5 UI Prototype", 5, 6), ("A6 Backend/API", 6, 8),
        ("A7 WebSocket Sync", 7, 9), ("A8 Audio Upload", 8, 10), ("A9 Testing", 10, 12),
        ("A10 Report/Presentation", 10, 13),
    ]
    img = Image.new("RGB", (1800, 980), "white")
    d = ImageDraw.Draw(img)
    font = get_font(24)
    small = get_font(20)
    left, top, cell_w, row_h = 300, 90, 105, 70
    for w in range(1, 14):
        x = left + (w - 1) * cell_w
        d.rectangle((x, top, x + cell_w, top + 50), outline=(180, 190, 200), fill=(232, 238, 246))
        d.text((x + 25, top + 12), f"W{w}", font=small, fill=(20, 35, 50))
    for i, (name, start, end) in enumerate(tasks):
        y = top + 60 + i * row_h
        d.text((30, y + 18), name, font=font, fill=(20, 35, 50))
        for w in range(1, 14):
            x = left + (w - 1) * cell_w
            d.rectangle((x, y, x + cell_w, y + row_h - 8), outline=(225, 230, 235), fill="white")
        x1 = left + (start - 1) * cell_w + 8
        x2 = left + end * cell_w - 8
        fill = (49, 130, 189) if i < 5 else (88, 165, 92)
        d.rounded_rectangle((x1, y + 12, x2, y + row_h - 20), radius=12, fill=fill)
    d.text((30, 900), "Weeks are counted from the beginning of the project plan. Work after the progress report focuses on prototype completion, testing and report finalisation.", font=small, fill=(70, 80, 90))
    img.save(path)


def draw_risk_matrix(path):
    img = Image.new("RGB", (1200, 900), "white")
    d = ImageDraw.Draw(img)
    font = get_font(28)
    small = get_font(22)
    left, top, size = 240, 120, 170
    colors = {
        (0, 0): (206, 235, 210), (1, 0): (206, 235, 210), (2, 0): (255, 237, 171),
        (0, 1): (206, 235, 210), (1, 1): (255, 237, 171), (2, 1): (255, 199, 150),
        (0, 2): (255, 237, 171), (1, 2): (255, 199, 150), (2, 2): (239, 138, 98),
    }
    for y in range(3):
        for x in range(3):
            x0 = left + x * size
            y0 = top + (2 - y) * size
            d.rectangle((x0, y0, x0 + size, y0 + size), fill=colors[(x, y)], outline=(140, 150, 160), width=2)
    for i, label in enumerate(["Low", "Medium", "High"]):
        d.text((left + i * size + 48, top + 3 * size + 20), label, font=small, fill=(20, 35, 50))
        d.text((55, top + (2 - i) * size + 60), label, font=small, fill=(20, 35, 50))
    d.text((left + 150, top + 3 * size + 80), "Impact", font=font, fill=(20, 35, 50))
    d.text((30, top - 60), "Probability", font=font, fill=(20, 35, 50))
    marks = [("R1", 2, 2), ("R2", 1, 2), ("R3", 2, 1), ("R4", 1, 1)]
    for label, x, y in marks:
        cx = left + x * size + size // 2
        cy = top + (2 - y) * size + size // 2
        d.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=(31, 78, 121))
        d.text((cx - 20, cy - 16), label, font=font, fill="white")
    d.text((760, 180), "R1 Real-time sync complexity", font=small, fill=(20, 35, 50))
    d.text((760, 240), "R2 Limited development time", font=small, fill=(20, 35, 50))
    d.text((760, 300), "R3 Large audio files/storage", font=small, fill=(20, 35, 50))
    d.text((760, 360), "R4 Skill gap in full-stack work", font=small, fill=(20, 35, 50))
    img.save(path)


def add_cover(doc):
    for _ in range(2):
        p = doc.add_paragraph()
    p = doc.add_paragraph("Faculty of Applied Sciences\nBachelor of Science in Computing")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.font.size = Pt(14)
    p = doc.add_paragraph("COMP4299 Final Year Project\nProgress Report\n\nAcademic Year 2026/27")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.bold = True
        r.font.size = Pt(18)
        r.font.color.rgb = RGBColor(31, 78, 121)
    doc.add_paragraph()
    table = doc.add_table(rows=8, cols=2)
    style_table(table, header=False)
    rows = [
        ("Project title:", PROJECT_TITLE), ("Project number:", PROJECT_NO), ("Student ID:", STUDENT_ID),
        ("Student name:", STUDENT_NAME), ("Supervisor:", SUPERVISOR), ("Assessor:", ""),
        ("Submission Date:", SUBMISSION_DATE), ("Current project status:", "First working web prototype completed; core event-based collaboration features demonstrated locally."),
    ]
    for row, (k, v) in zip(table.rows, rows):
        set_cell_text(row.cells[0], k, bold=True, size=10)
        set_cell_text(row.cells[1], v, size=10)
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_contents(doc):
    add_heading(doc, "Table of Contents", 1)
    items = [
        "1. Introduction",
        "2. Background and Related Works",
        "3. Project Management and Risk Management",
        "4. Monthly Status Review",
        "5. Completed Work",
        "6. Conclusion",
        "References",
        "Appendix A. Ethics Checklist",
        "Appendix B. Declaration of the Use of Generative AI in FYP",
    ]
    for item in items:
        p = doc.add_paragraph(item)
        p.paragraph_format.left_indent = Inches(0.25)
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_intro(doc):
    add_heading(doc, "1. Introduction", 1)
    add_body(doc, "Music production is increasingly shaped by remote work and online creative collaboration. Musicians, producers and students often need to exchange ideas without being in the same studio, but many common music creation workflows still depend on sending project files, stems or audio clips back and forth. This makes collaborative editing slow, especially when several users need to comment on timing, arrange clips, or review changes repeatedly.")
    add_body(doc, "The problem addressed by this project is that online music collaboration is difficult when users cannot view and edit the same project state at the same time. Continuous low-latency audio streaming is technically demanding under ordinary network conditions, so this project takes a more achievable approach: it focuses on synchronising user actions and shared project metadata in real time, while uploaded audio clips are stored and referenced by the system.")
    add_heading(doc, "1.1 Societal, User and Business Needs", 2)
    add_body(doc, "The project responds to social and user needs created by remote learning, distributed creative teams and online content production. A browser-based collaborative tool can reduce the need for physical studio access and allow users in different places to work on early-stage composition ideas together.")
    add_body(doc, "Target users need a simple interface for creating rooms, uploading clips, arranging tracks, chatting and seeing other users' edits quickly. From a business and product perspective, the project has value because many creative platforms are moving towards cloud-based collaboration. A lightweight implementation can demonstrate how real-time event synchronisation may support collaborative music creation without requiring specialist audio-network infrastructure.")
    add_body(doc, "The main ethical and legal needs are privacy, account data protection and appropriate handling of uploaded audio. The system should avoid collecting unnecessary personal data, protect user account information, and remind users that they should upload only audio they have the right to use.")
    add_heading(doc, "1.2 Objectives", 2)
    add_numbered(doc, [
        "Build a web-based prototype that allows users to create or join a collaboration room by the end of the implementation stage.",
        "Provide basic audio clip upload, storage and listing functions so that users can share short audio materials within a room.",
        "Implement real-time synchronisation of user actions such as adding, moving or deleting clips using WebSocket communication or an equivalent room-event update channel.",
        "Design a clear and usable interface for room management, track display, chat and simple clip arrangement.",
        "Test the prototype with representative scenarios and evaluate whether shared project state remains consistent across multiple clients.",
    ])
    add_heading(doc, "1.3 Ethical Consideration", 2)
    add_body(doc, "The ethics checklist is included in Appendix A. The project does not require human-subject experiments at this stage, but it may store basic user account information and uploaded audio clips. The design will therefore minimise personal data collection and use the data only for project demonstration purposes.")
    add_heading(doc, "1.4 Summary", 2)
    add_body(doc, "This report first introduces the project problem and objectives, then reviews related work on networked music collaboration and low-latency audio systems. It then presents project management plans, risk management, the monthly status review, and the work completed so far. Since a first working web prototype has now been developed, the report focuses on the implemented foundation, current limitations, and the remaining work needed before the final submission.")
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_background(doc):
    add_heading(doc, "2. Background and Related Works", 1)
    add_body(doc, "Networked music collaboration has been discussed for many years, but the technical requirements vary depending on whether the system aims to stream live audio performance or support asynchronous/semi-synchronous composition. Oliveros [1] highlights that networked music can expand creative practice, but also introduces technical and communication challenges.")
    add_body(doc, "Systems such as JackTrip [2] show the importance of low-latency audio transmission for real-time performance. However, such systems often require careful setup, strong network conditions and specialist knowledge. For a general web-based student project, building a full low-latency streaming engine would create high technical risk.")
    add_body(doc, "More recent work on Audio over OSC (AOO) [3] demonstrates message-based communication for audio and metadata, which supports the idea that not all collaboration has to depend on continuous raw audio streaming. Research evaluating networked music performance over LEO satellite internet [4] further confirms that latency, jitter and packet loss remain difficult challenges even when advanced network infrastructure is used.")
    add_body(doc, "Based on these related works, this project narrows its scope. Instead of attempting professional live-performance streaming, it will implement event-based synchronisation for a shared music composition workspace. The expected contribution is a practical prototype that demonstrates collaborative project-state synchronisation in a music-oriented interface.")
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_management(doc):
    add_heading(doc, "3. Project Management and Risk Management", 1)
    add_body(doc, "This chapter explains how the project will be managed after the progress report stage. A first working prototype has been completed, so the remaining schedule now prioritises strengthening the event synchronisation workflow, improving audio-clip handling, adding persistence, and preparing the final evaluation.")
    add_heading(doc, "3.1 Project Time Management", 2)
    activities = [
        ("A1", "Confirm scope, tools and development environment", "2 days", "-"),
        ("A2", "Requirement analysis and user scenario definition", "3 days", "A1"),
        ("A3", "Background research and related work review", "5 days", "A1"),
        ("A4", "System architecture and database design", "3 days", "A2"),
        ("A5", "User interface wireframe and polished room workflow design", "3 days", "A4"),
        ("A6", "Local prototype server and room API implementation", "5 days", "A4"),
        ("A7", "Frontend room, dashboard and track interface implementation", "7 days", "A5"),
        ("A8", "Event synchronisation prototype using server-sent updates", "4 days", "A6, A7"),
        ("A9", "Audio upload metadata and clip movement prototype", "4 days", "A6, A7"),
        ("A10", "Persistence, Socket.io refinement and multi-client testing", "7 days", "A8, A9"),
        ("A11", "Final report writing, evaluation and presentation preparation", "10 days", "A10"),
    ]
    table = doc.add_table(rows=1, cols=4)
    hdr = table.rows[0].cells
    for i, h in enumerate(["Activity", "Description", "Duration", "Predecessor"]):
        set_cell_text(hdr[i], h, bold=True)
    for row in activities:
        cells = table.add_row().cells
        for i, text in enumerate(row):
            set_cell_text(cells[i], text)
    style_table(table)
    add_caption(doc, "Figure 1: Activity List")
    pdm = ASSET_DIR / "pdm.png"
    gantt = ASSET_DIR / "gantt.png"
    draw_pdm(pdm)
    draw_gantt(gantt)
    doc.add_picture(str(pdm), width=Inches(6.4))
    add_caption(doc, "Figure 2: Precedence Diagramming Method Diagram")
    doc.add_picture(str(gantt), width=Inches(6.4))
    add_caption(doc, "Figure 3: Gantt Chart")
    add_heading(doc, "3.2 Project Risk Management", 2)
    risks = [
        ("1", "R1: Real-time synchronisation is more complex than expected", "High", "High", "Reduce scope to event synchronisation first; test with two clients before adding optional features."),
        ("2", "R2: Development time is limited and some advanced functions remain incomplete", "High", "Medium", "Keep the prototype focused on room creation, clip management, track editing and event synchronisation; defer advanced DAW editing and live audio streaming."),
        ("3", "R3: Large audio files may slow down upload and storage", "Medium", "High", "Restrict file type and size; store metadata separately; use short audio clips for prototype testing."),
        ("4", "R4: Full-stack and real-time networking skill gaps may slow progress", "Medium", "Medium", "Use established frameworks such as React, Node.js/Express, MongoDB and Socket.io; follow official documentation and build in small increments."),
    ]
    table = doc.add_table(rows=1, cols=5)
    for i, h in enumerate(["Priority", "Risk Identifier and Description", "Probability", "Impact", "Response"]):
        set_cell_text(table.rows[0].cells[i], h, bold=True)
    for risk in risks:
        cells = table.add_row().cells
        for i, text in enumerate(risk):
            set_cell_text(cells[i], text)
    style_table(table)
    add_caption(doc, "Table 1: Table of Prioritized Risk")
    matrix = ASSET_DIR / "risk_matrix.png"
    draw_risk_matrix(matrix)
    doc.add_picture(str(matrix), width=Inches(5.9))
    add_caption(doc, "Figure 4: Probability Impact Matrix Before Proposed Response")
    add_body(doc, "After the proposed responses, the residual risk should be lower because the project scope is controlled around a minimum viable collaborative workspace. The highest remaining risk is still short development time, so the remaining work will focus on reliability and evaluation before optional interface polish.")
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_status_completed_conclusion(doc):
    add_heading(doc, "4. Monthly Status Review", 1)
    table = doc.add_table(rows=1, cols=4)
    for i, h in enumerate(["Period", "Work completed", "Current issue", "Plan for next month / next stage"]):
        set_cell_text(table.rows[0].cells[i], h, bold=True)
    rows = [
        ("March 2026", "Project proposal completed; project problem, objectives, risks and preliminary references identified.", "The implementation scope was still broad.", "Narrow the project to event-based collaboration instead of full live audio streaming."),
        ("April 2026", "Related work reviewed; core technical direction confirmed: room-based web platform, audio clip upload, WebSocket state synchronisation.", "Need to convert proposal into an implementation plan.", "Prepare architecture, data model and UI workflow."),
        ("May 2026", "First working prototype developed. The website includes a polished homepage, dashboard, demo collaboration room, track list, timeline, mock audio clips, chat panel, upload metadata UI, track renaming and drag-to-move clip events.", "The prototype currently uses in-memory room data and a local preview server; production database persistence and user authentication are not yet completed.", "Strengthen persistence, refine event synchronisation, improve upload/playback handling and prepare testing evidence."),
        ("June 2026", "Planned submission of progress report and prototype demonstration.", "Time is the main constraint, and the final project must avoid over-expanding into raw audio streaming.", "Complete the event-based collaboration loop, test with multiple browser clients and document limitations clearly for the final report."),
    ]
    for row in rows:
        cells = table.add_row().cells
        for i, text in enumerate(row):
            set_cell_text(cells[i], text, size=9)
    style_table(table)
    add_heading(doc, "5. Completed Work", 1)
    add_body(doc, "At the progress report stage, a first executable prototype has been completed. The current implementation is not intended to be a full digital audio workstation or a low-latency live performance streaming system. Instead, it demonstrates the main project direction: collaborative music editing through synchronised user actions and shared room state.")
    add_bullets(doc, [
        "A polished product-style homepage has been implemented to explain the system scope, including collaboration rooms, audio clip management, event-based synchronisation and room chat.",
        "A dashboard page has been implemented where users can view recent mock rooms, create a new collaboration room and enter a demo workspace.",
        "A demo collaboration room interface has been implemented with a top bar, online collaborator avatars, track sidebar, timeline canvas, mock audio clips, playback controls, upload button and chat panel.",
        "Track management has been implemented at prototype level: users can add new tracks and rename track names directly in the sidebar.",
        "Clip interaction has been implemented at prototype level: users can upload audio metadata and drag clips horizontally on the timeline to simulate arrangement changes.",
        "Room chat has been implemented at prototype level, allowing users to write and send room notes beside the timeline.",
        "Event-based synchronisation has been demonstrated locally using server-sent room updates, so actions such as chat messages, track additions, track renaming and clip movements can update the shared room state.",
        "The visual interface has been refined with a dark premium music-workspace style, glassmorphism panels, soft shadows, low-saturation gradients and responsive layout behaviour.",
        "A reusable component structure has been created in the Next.js source folder, including navigation, glass cards/buttons, feature cards, room cards, track list, timeline, audio clip, chat panel and collaborator avatars.",
    ])
    add_body(doc, "The main difficulty encountered so far is balancing a polished demonstration with realistic technical scope. A full real-time music production platform would be too large for the remaining period, especially if it attempted live raw audio streaming. Therefore, the adopted solution is to build a smaller but demonstrable event-based prototype. This keeps the project aligned with the original goal while making completion more realistic.")
    add_heading(doc, "5.1 Current Prototype Functions", 2)
    functions = [
        ("Homepage", "Explains the product concept and project direction, including rooms, audio clips, collaborative editing, event-based synchronisation and the decision not to stream raw live audio."),
        ("Dashboard", "Shows mock music rooms, supports creating a new room and provides navigation into the demo room."),
        ("Collaboration room", "Provides the simplified collaborative music editor layout with tracks, timeline, clips, controls, chat and online collaborator avatars."),
        ("Track editing", "Supports adding tracks and renaming tracks from the sidebar. Renaming is saved after pressing Enter or leaving the input field."),
        ("Clip workflow", "Supports upload metadata UI and drag-to-move clip interaction on the timeline, representing event-based arrangement changes."),
        ("Chat", "Supports sending room notes that appear in the room chat panel."),
        ("Event sync", "Uses local room update events to keep the prototype state aligned across connected clients."),
    ]
    table = doc.add_table(rows=1, cols=3)
    for i, h in enumerate(["Area", "Implemented function", "Status"]):
        set_cell_text(table.rows[0].cells[i], h, bold=True)
    for area, function, status in [(a, f, "Prototype completed") for a, f in functions]:
        cells = table.add_row().cells
        set_cell_text(cells[0], area, size=9)
        set_cell_text(cells[1], function, size=9)
        set_cell_text(cells[2], status, size=9)
    style_table(table)
    add_caption(doc, "Table 2: Current Prototype Function Summary")
    add_heading(doc, "5.2 Limitations and Remaining Work", 2)
    add_bullets(doc, [
        "The current preview server stores data in memory, so database persistence must be added before final submission.",
        "The prototype does not yet include user registration, authentication or role-based room access.",
        "The upload function currently focuses on clip metadata and interface flow; final work should improve real file storage and playback handling.",
        "The event synchronisation prototype should be refined using Socket.io or a more production-ready real-time layer.",
        "The room interface should be tested with multiple browser clients to confirm that track edits, chat messages and clip movements remain consistent.",
        "The final evaluation should include test scenarios, screenshots and a clear explanation of why event-based collaboration is used instead of raw audio streaming.",
    ])
    add_heading(doc, "6. Conclusion", 1)
    add_body(doc, "This progress report shows that the project has moved beyond proposal and planning into a first working prototype. The current website demonstrates the central idea of the project: users work in a shared music room, manage tracks and clips, chat beside the timeline, and synchronise editing actions rather than streaming live raw audio.")
    add_body(doc, "For the next stage, I will avoid adding optional features until the core collaboration loop works reliably. The priorities are to improve persistence, refine the real-time event layer, strengthen audio clip handling, test the prototype with multiple clients and prepare clear evidence for the final report and presentation.")
    doc.add_section(WD_SECTION.NEW_PAGE)


def add_references_appendices(doc):
    add_heading(doc, "References", 1)
    refs = [
        "[1] Pauline Oliveros. Networked music: Low and high tech. Contemporary Music Review, 28(4-5):433-435, 2009.",
        "[2] Juan-Pablo Caceres and Chris Chafe. JackTrip: Under the hood of an engine for network audio. Journal of New Music Research, 39(3):183-187, 2010.",
        "[3] Ivica Ico Ressi. AOO: Low-latency peer-to-peer audio streaming and messaging. https://www.soundingfuture.com/en/article/aoo-low-latency-peer-peer-audio-streaming-and-messaging, 2024 [accessed Mar. 18, 2026].",
        "[4] Luca Borgianni, Daniele Adami, Marco Bosi, Stefano Giordano and Chris Chafe. A comprehensive evaluation of networked music performance using LEO satellite internet: The Starlink use case. IEEE Transactions on Network and Service Management, 22(5):3947-3963, Oct. 2025.",
    ]
    for ref in refs:
        add_body(doc, ref)
    doc.add_section(WD_SECTION.NEW_PAGE)
    add_heading(doc, "Appendix A. Ethics Checklist", 1)
    meta = doc.add_table(rows=5, cols=2)
    for row, (k, v) in zip(meta.rows, [
        ("Name of student:", STUDENT_NAME), ("Student number:", STUDENT_ID), ("Programme:", "BSc in Computing"),
        ("Module:", "Final Year Project"), ("Title of project:", PROJECT_TITLE),
    ]):
        set_cell_text(row.cells[0], k, bold=True)
        set_cell_text(row.cells[1], v)
    style_table(meta, header=False)
    add_body(doc, "Project summary: This project develops a browser-based collaborative music composition prototype. Users can create rooms, upload short audio clips, edit track names, move clips on a timeline, send room chat messages and synchronise editing actions through a real-time room-event channel. The project is intended as a technical prototype and does not require formal user experiments at the progress report stage.")
    qtable = doc.add_table(rows=1, cols=5)
    for i, h in enumerate(["No.", "Question", "Yes", "No", "N/A"]):
        set_cell_text(qtable.rows[0].cells[i], h, bold=True)
    questions = [
        ("1", "Does your project include human participants?", "", "", "✓"),
        ("2", "Will any participants be from vulnerable groups?", "", "", "✓"),
        ("3", "Will you tell participants that participation is voluntary?", "", "", "✓"),
        ("4", "Will you obtain written consent for participation?", "", "", "✓"),
        ("5", "Will participants be told that they may withdraw at any time?", "", "", "✓"),
        ("6", "Is there any realistic risk of physical or psychological distress?", "", "✓", ""),
        ("7", "Will any non-anonymised and/or personalised data be generated and/or stored?", "✓", "", ""),
        ("8", "Will you access documents containing sensitive data about living individuals?", "", "✓", ""),
        ("9", "Will you be exposed to risks greater than normal study/working life?", "", "✓", ""),
        ("10", "Will you be exposed to highly addictive or illegal activities?", "", "✓", ""),
    ]
    for q in questions:
        cells = qtable.add_row().cells
        for i, text in enumerate(q):
            set_cell_text(cells[i], text, size=9)
    style_table(qtable)
    add_body(doc, "Potential ethics issue handling: The prototype may store basic account details and uploaded audio clips. The system design will minimise personal data, use the information only for project demonstration, and avoid collecting sensitive information. Users should upload only audio material they are allowed to use.")
    add_body(doc, "Declaration: I have read the instructions carefully and reported honestly the potential ethics issues about the project.")
    doc.add_section(WD_SECTION.NEW_PAGE)
    add_heading(doc, "Appendix B. Declaration of the Use of Generative AI in FYP", 1)
    add_body(doc, "Please tick either one below.")
    add_body(doc, "☒ I have used generative AI in this assessment work")
    add_body(doc, "☐ I did not use generative AI in this assessment work")
    add_body(doc, "Generative AI tool used: OpenAI ChatGPT / Codex.")
    table = doc.add_table(rows=1, cols=3)
    for i, h in enumerate(["Type of usage", "GenAI assistance received", "Student action on generated content"]):
        set_cell_text(table.rows[0].cells[i], h, bold=True)
    rows = [
        ("Brainstorming and idea generation", "Helped organise the project problem, objectives and scope.", "Reviewed and kept content consistent with the approved proposal."),
        ("Literature review and background research", "Helped summarise related work already listed in the proposal.", "Checked that references match the project topic."),
        ("Programming support", "Helped scaffold and refine the first working website prototype, including UI structure, local preview server logic and event-based interaction flow.", "Reviewed the generated code, tested the website locally and kept the implementation aligned with the approved project scope."),
        ("Visualization and diagram production", "Helped generate activity, PDM, Gantt and risk-management visuals.", "Reviewed diagrams for consistency with the schedule."),
        ("Text Rewriting and Drafting", "Helped draft report sections in academic English.", "Reviewed, edited and accepted responsibility for the final wording."),
    ]
    for row in rows:
        cells = table.add_row().cells
        for i, text in enumerate(row):
            set_cell_text(cells[i], text, size=9)
    style_table(table)
    add_body(doc, "Student signature: ____________________________    Date: " + SUBMISSION_DATE)


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    styles = doc.styles
    styles["Normal"].font.name = "Arial"
    styles["Normal"].font.size = Pt(11)
    for name in ["Heading 1", "Heading 2", "Heading 3"]:
        styles[name].font.name = "Arial"
    add_cover(doc)
    add_contents(doc)
    add_intro(doc)
    add_background(doc)
    add_management(doc)
    add_status_completed_conclusion(doc)
    add_references_appendices(doc)
    doc.save(OUT)


if __name__ == "__main__":
    build()
