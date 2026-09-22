const defaultUkeord = ["sjokolade", "kjøkken", "familie", "sykkel", "håndkle", "vennskap"];
const defaultGloser = [{ no: "hund", en: "dog" }, { no: "katt", en: "cat" }, { no: "hus", en: "house" }, { no: "bil", en: "car" }, { no: "bok", en: "book" }, { no: "skole", en: "school" }];
const customStorageKeys = { ukeord: "ukeordCustom", gloser: "gloserCustom" };
let selectedMode = "", questions = [], currentQuestion = 0, score = 0, answerLocked = false;

function shuffle(array) { const result = [...array]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function speakText(text, language = "nb-NO", cancel = true) { if (!text || !("speechSynthesis" in window)) return; if (cancel) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = language; u.rate = .9; speechSynthesis.speak(u); }
function speakFeedback(correct) { speakText(correct ? "Riktig!" : "Prøv igjen!", "nb-NO"); }
function parseUkeordInput(value) { return value.split(/\n+/).map(x => x.trim().replace(/^[-*•]\s*/, "")).filter(Boolean); }
function parseGloserInput(value) { return value.split(/\n+/).map(x => x.trim().replace(/^[-*•]\s*/, "")).map(x => { const m = x.match(/^(.+?)\s*(?:-|:|,)\s*(.+)$/); return m ? { no: m[1].trim(), en: m[2].trim() } : null; }).filter(Boolean); }
function getStoredList(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : fallback; } catch (_) { return fallback; } }
function getUkeordList() { const x = getStoredList(customStorageKeys.ukeord, []); return x.length ? x : defaultUkeord; }
function getGloserList() { const x = getStoredList(customStorageKeys.gloser, []); return x.length ? x : defaultGloser; }
function setCustomStatus(message, error = false) { const el = document.getElementById("customStatus"); if (el) { el.textContent = message; el.classList.toggle("status-error", error); } }
function setCustomWordsHidden(hidden) { const section = document.getElementById("customWords"), button = document.getElementById("toggleWordsBtn"); if (!section || !button) return; section.classList.toggle("words-hidden", hidden); button.textContent = hidden ? "Vis egne ord" : "🙈 Skjul egne ord"; button.setAttribute("aria-pressed", String(hidden)); }
function loadCustomLists() { const u = document.getElementById("customUkeordInput"), g = document.getElementById("customGloserInput"); if (!u || !g) return; u.value = getStoredList(customStorageKeys.ukeord, defaultUkeord).join("\n"); g.value = getStoredList(customStorageKeys.gloser, defaultGloser).map(x => `${x.no} - ${x.en}`).join("\n"); }
function saveCustomLists() { const u = parseUkeordInput(document.getElementById("customUkeordInput").value), g = parseGloserInput(document.getElementById("customGloserInput").value); if (u.length) localStorage.setItem(customStorageKeys.ukeord, JSON.stringify(u)); else localStorage.removeItem(customStorageKeys.ukeord); if (g.length) localStorage.setItem(customStorageKeys.gloser, JSON.stringify(g)); else localStorage.removeItem(customStorageKeys.gloser); setCustomStatus("Dine egne ord er lagret."); }

function cleanOCRWord(value) { return String(value || "").replace(/[^\p{L}\s'-]/gu, "").replace(/\s+/g, " ").trim(); }
function ignoredOCRWord(value) { return /^(norsk|english|norwegian|ukeord|gloser|timeplan|lekse|step|read|pupil|usually|mate|chat|because|elev|vanligvis|kompis|prate|fordi)$/i.test(value); }
function unique(values) { return [...new Map(values.map(x => [x.toLowerCase(), x])).values()]; }

// Uses OCR word positions, not the OCR text order. This keeps the three table columns separate.
function parseOCRTable(data) {
    const words = (data && data.words ? data.words : []).map(word => ({
        text: cleanOCRWord(word.text), left: word.bbox.left, top: word.bbox.top,
        center: (word.bbox.left + word.bbox.right) / 2
    })).filter(word => word.text && !ignoredOCRWord(word.text));
    const rows = [];
    words.sort((a, b) => a.top - b.top || a.left - b.left).forEach(word => {
        let row = rows.find(item => Math.abs(item.top - word.top) < 22);
        if (!row) { row = { top: word.top, words: [] }; rows.push(row); }
        row.words.push(word);
    });
    const dataRows = rows.map(row => row.words.sort((a, b) => a.left - b.left)).filter(row => row.length >= 3);
    const ukeord = [], gloser = [];
    dataRows.forEach(row => {
        const [first, second, third] = row;
        if (!first || !second || !third) return;
        if (first.text.length < 2 || second.text.length < 2 || third.text.length < 2) return;
        ukeord.push(first.text);
        gloser.push({ no: third.text, en: second.text });
    });
    return { ukeord: unique(ukeord), gloser: gloser.filter((entry, i, list) => list.findIndex(x => x.no.toLowerCase() === entry.no.toLowerCase() && x.en.toLowerCase() === entry.en.toLowerCase()) === i) };
}
function mergeImported(imported) { const u = document.getElementById("customUkeordInput"), g = document.getElementById("customGloserInput"); const ukeord = unique([...parseUkeordInput(u.value), ...imported.ukeord]); const gloser = [...parseGloserInput(g.value), ...imported.gloser].filter((x, i, list) => list.findIndex(y => y.no.toLowerCase() === x.no.toLowerCase() && y.en.toLowerCase() === x.en.toLowerCase()) === i); u.value = ukeord.join("\n"); g.value = gloser.map(x => `${x.no} - ${x.en}`).join("\n"); }
async function handleImageUpload(event) { const file = event.target.files && event.target.files[0]; if (!file) return; if (!window.Tesseract) { setCustomStatus("OCR-biblioteket ble ikke lastet. Last siden på nytt.", true); return; } setCustomStatus("Leser tabellen i bildet …"); try { const result = await Tesseract.recognize(file, "nor+eng", { logger: m => { if (m.status === "recognizing text") setCustomStatus(`Leser tabellen i bildet … ${Math.round((m.progress || 0) * 100)}%`); } }); const imported = parseOCRTable(result.data); if (!imported.ukeord.length) throw new Error("Ingen tabellrader funnet"); mergeImported(imported); setCustomStatus(`Importert ${imported.ukeord.length} ukeord og ${imported.gloser.length} gloser. Kontroller feltene før lagring.`); } catch (error) { console.error(error); setCustomStatus("Fant ikke en tydelig tabell. Ta bildet nærmere og rett ovenfra.", true); } finally { event.target.value = ""; } }

function startGame(mode) { selectedMode = mode; score = 0; currentQuestion = 0; answerLocked = false; questions = shuffle(mode === "ukeord" ? getUkeordList() : getGloserList()); document.getElementById("score").textContent = score; setCustomWordsHidden(true); document.getElementById("game").classList.remove("hidden"); showQuestion(); }
function showQuestion() { const input = document.getElementById("answer"), feedback = document.getElementById("feedback"), question = document.getElementById("question"), replay = document.getElementById("replayAudioBtn"); answerLocked = false; input.disabled = false; input.value = ""; input.focus(); feedback.textContent = ""; document.getElementById("progress").textContent = `${currentQuestion + 1} / ${questions.length}`; replay.classList.toggle("hidden", selectedMode !== "ukeord"); if (selectedMode === "ukeord") { question.textContent = "🎧 Hør ordet og skriv det du hørte"; setTimeout(() => { if (!answerLocked) speakText(questions[currentQuestion]); }, 500); } else question.innerHTML = `Hva er engelsk for:<br><br><b>${questions[currentQuestion].no}</b>`; }
function checkAnswer() { if (answerLocked) return; const input = document.getElementById("answer"), feedback = document.getElementById("feedback"), entry = questions[currentQuestion]; answerLocked = true; const correct = input.value.trim().toLowerCase() === (selectedMode === "ukeord" ? entry.toLowerCase() : entry.en.toLowerCase()); speakFeedback(correct); if (correct) { score++; document.getElementById("score").textContent = score; feedback.className = "correct"; feedback.textContent = "✅ Riktig!"; currentQuestion++; setTimeout(currentQuestion < questions.length ? showQuestion : showResult, 1200); } else { feedback.className = "wrong"; feedback.textContent = "🔁 Prøv igjen!"; answerLocked = false; input.select(); } }
function showResult() { document.getElementById("question").textContent = "🏆 Ferdig!"; document.getElementById("feedback").innerHTML = `Du fikk ${score} av ${questions.length} poeng!`; document.getElementById("progress").textContent = "Fullført"; document.getElementById("answer").disabled = true; }
function initApp() { document.getElementById("checkBtn").addEventListener("click", checkAnswer); document.getElementById("answer").addEventListener("keydown", e => { if (e.key === "Enter") checkAnswer(); }); document.getElementById("saveCustomBtn").addEventListener("click", saveCustomLists); document.getElementById("importImageBtn").addEventListener("click", () => document.getElementById("imageUploadInput").click()); document.getElementById("imageUploadInput").addEventListener("change", handleImageUpload); document.getElementById("replayAudioBtn").addEventListener("click", () => speakText(questions[currentQuestion])); document.getElementById("toggleWordsBtn").addEventListener("click", () => setCustomWordsHidden(!document.getElementById("customWords").classList.contains("words-hidden"))); loadCustomLists(); }
document.addEventListener("DOMContentLoaded", initApp);
