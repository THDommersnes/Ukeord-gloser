(() => {
    function clean(value) {
        return String(value || "").replace(/[^\p{L}\s'-]/gu, "").replace(/\s+/g, " ").trim();
    }

    function uniqueEntries(entries) {
        return entries.filter((entry, index, list) => list.findIndex(item => item.no.toLowerCase() === entry.no.toLowerCase() && item.en.toLowerCase() === entry.en.toLowerCase()) === index);
    }

    function isLessonPlanText(value) {
        const text = String(value || "").toLowerCase();
        return /(lekseplan|leseplan|timeplan|lese til|lekse til|step\s*\d|read\s*p\.|read\s*s\.|p\.\s*\d+|s\.\s*\d+|torsdag|fredag|mandag|tirsdag|onsdag|bokslukerprisen|boks|\blese\b)/i.test(text);
    }

    function parseLines(data) {
        const result = [];
        const lines = data && Array.isArray(data.lines) ? data.lines : [];

        lines.forEach(line => {
            const words = (line.words || []).map(word => {
                const box = word.bbox || {};
                return { text: clean(word.text), left: box.left || 0, right: box.right || box.left || 0 };
            }).filter(word => word.text);

            if (words.length < 2) return;
            words.sort((a, b) => a.left - b.left);

            let split = 1;
            let largestGap = -1;
            for (let i = 1; i < words.length; i++) {
                const gap = words[i].left - words[i - 1].right;
                if (gap > largestGap) { largestGap = gap; split = i; }
            }

            const english = words.slice(0, split).map(word => word.text).join(" ");
            const norwegian = words.slice(split).map(word => word.text).join(" ");
            if (english.length < 2 || norwegian.length < 2) return;
            if (isLessonPlanText(`${english} ${norwegian}`)) return;
            result.push({ no: norwegian, en: english });
        });

        return uniqueEntries(result);
    }

    function parsePlainText(data) {
        const text = String((data && data.text) || "");
        const result = [];
        text.split(/\r?\n/).forEach(line => {
            const cleaned = line.replace(/Weekly\s+words:?/i, "").trim();
            if (!cleaned || /^(teased|bullied|parents|lunch break|famous|erta|mobba|foreldre|matpause|berømt|weekly words|timeplan|norsk|english|norwegian)$/i.test(cleaned)) return;
            if (isLessonPlanText(cleaned)) return;

            const parts = cleaned.split(/\t+|\s{3,}/).map(clean).filter(Boolean);
            if (parts.length >= 2) {
                result.push({ no: parts.slice(1).join(" "), en: parts[0] });
            }
        });
        return uniqueEntries(result);
    }

    async function importImageFallback(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!window.Tesseract) {
            setCustomStatus("OCR-biblioteket ble ikke lastet. Last siden på nytt.", true);
            return;
        }

        setCustomStatus("Leser ordlisten i bildet...");
        try {
            const result = await Tesseract.recognize(file, "eng+nor", {
                logger: message => {
                    if (message.status === "recognizing text") {
                        setCustomStatus(`Leser ordlisten i bildet... ${Math.round((message.progress || 0) * 100)}%`);
                    }
                }
            });

            let gloser = parseLines(result.data);
            if (!gloser.length) gloser = parsePlainText(result.data);
            if (!gloser.length) throw new Error("OCR fant ingen ordpar");

            mergeImported({ ukeord: [], gloser });
            setCustomStatus(`Importert ${gloser.length} gloser. Sjekk gjerne ordene før du lagrer.`);
        } catch (error) {
            console.error(error);
            setCustomStatus("Fant ikke ordpar i bildet. Beskjær rundt Weekly words-tabellen og prøv igjen.", true);
        } finally {
            event.target.value = "";
        }
    }

    // Capture phase stops the older handler in script.js from rejecting a valid
    // two-column screenshot before this more tolerant parser gets a chance.
    document.addEventListener("change", event => {
        if (event.target && event.target.id === "imageUploadInput") {
            event.stopImmediatePropagation();
            importImageFallback(event);
        }
    }, true);
})();

