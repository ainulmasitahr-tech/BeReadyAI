export const SAMPLE_CONTEXTS = [
  {
    id: 'ai-study-coach',
    label: 'AI Study Coach',
    courseTag: 'AI in Education · System Design',
    title: 'BeReady AI: Multimodal Oral Exam & Technical Presentation Simulator',
    content: `Project Title: BeReady AI (Automated Oral Exam & Presentation Simulator)

Problem Statement:
Students frequently experience anxiety, uneven pacing, and difficulty articulating clear technical justifications during oral examinations, project defenses, and capstone presentations. Passive revision methods such as re-reading slides or memorizing scripts do not train students to respond to unexpected follow-up probes from an examining panel.

Proposed Solution & Architecture:
BeReady AI is a full-stack web application built with React, Node.js, Express, and Google Gemini AI models:
1. Document & Diagram Ingestion: Students upload lecture slides or proposals (.pdf, .docx, .txt, .md) parsed server-side via unpdf and mammoth, plus optional architecture diagrams or slide screenshots (PNG/JPG/WEBP) inspected via Gemini multimodal vision.
2. Context-Grounded Question Generation (gemini-4-hydrogen): Generates realistic oral defense questions categorized by System Architecture, Diagram Defense, Tool Justification, Methodology, and Edge Cases with expected examiner key points.
3. Bidirectional Voice Interaction & Exam Pressure Mode: Supports live browser Web Speech API dictation paired with a real-time microphone waveform, Audio Clip recording via Gemini 3.5 Transcribe (gemini-3.5-transcribe), and Examiner Text-to-Speech via Gemini TTS (gemini-3.8-flash-lite-tts). Exam Mode hides checklist hints, auto-plays examiner audio, locks typing edits, and enforces a countdown timer.
4. Speech Delivery Coach & Rubric Evaluation: Evaluates spoken answers against 4 weighted criteria (Technical Accuracy, Justification Depth, Clarity & Structure, Confidence & Conciseness) using structured JSON schemas, tracks speaking pace (WPM) and filler words, provides an A+ spoken model answer, and asks a tailored follow-up probe.`,
  },
  {
    id: 'iot-waste',
    label: 'IoT ESP32 Project',
    courseTag: 'Embedded Systems · Capstone Project',
    title: 'Smart Campus Waste Bin Monitoring System Using ESP32 & Ultrasonic Sensors',
    content: `Project Abstract: Smart Campus Waste Bin Monitoring System
This project addresses overflowing waste bins and inefficient manual collection schedules across campus blocks. An ESP32 microcontroller is paired with an HC-SR04 ultrasonic distance sensor mounted inside each bin lid to measure fill-level percentage every 15 minutes. Using built-in Wi-Fi, the ESP32 transmits JSON telemetry payloads via HTTPS REST API to a cloud backend database. When a bin exceeds 85% capacity, the system triggers an automated priority route notification to custodial staff on a live web dashboard.

Technical Architecture & Justification:
- Microcontroller: ESP32 chosen over Arduino Uno due to integrated 802.11 Wi-Fi, deep-sleep power mode (extending Li-Ion battery life to 14 days), and dual-core processing.
- Sensor: HC-SR04 ultrasonic sensor operates reliably regardless of trash color or ambient lighting compared to IR sensors, though requires waterproofing calibration in humid weather.
- Backend & Alerts: Node.js REST endpoint validates sensor readings using a 3-sample median filter to reject false spikes when waste is dropped past the sensor beam.`,
  },
  {
    id: 'dbms-notes',
    label: 'DBMS Lecture Notes',
    courseTag: 'Software Engineering · Revision',
    title: 'Relational Database Normalization (1NF, 2NF, 3NF) & ACID Transactions',
    content: `Lecture Summary: Database Normalization & Transaction Integrity
1. First Normal Form (1NF): Every attribute must hold atomic (indivisible) values, and repeating groups must be eliminated by creating separate rows with a primary key.
2. Second Normal Form (2NF): Must satisfy 1NF, and every non-key attribute must be fully functionally dependent on the entire composite primary key (eliminating partial dependencies).
3. Third Normal Form (3NF): Must satisfy 2NF, and there must be no transitive dependencies—non-key attributes must depend only on the primary key, not on other non-key attributes.
4. ACID Properties:
- Atomicity: All operations in a transaction succeed together or roll back completely.
- Consistency: A transaction transitions the database from one valid constraint-satisfying state to another.
- Isolation: Concurrent transactions execute without interfering with each other's intermediate states.
- Durability: Once committed, transaction changes persist in non-volatile storage even after a power failure.`,
  },
];
