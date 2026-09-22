(() => {
    function clean(value) {
        return String(value || "").replace(/[^\p{L}\s'-]/gu, "").replace(/\s+/g, " ").trim();
    }

    function uniqueEntries(entries) {
        return entries.filter((entry, index, list) => list.findIndex(item => item.no.toLowerCase() === entry.no.toLowerCase() && item.en.toLowerCase() === entry.en.toLowerCase()) === index);
    }

    function isLessonPlanText(value) {
        const text = String(value || "").toLowerCase();
        return /(lekseplan|leseplan|timeplan|lese til|lekse til|step\s*\d|read\s*p\.|read\s*s\.|p\.\s*\d+|s\.\s*\d+|torsdag|fredag|mandag|tirsdag|onsdag|bokslukerprisen|\blese\b)/i.test(text);
    }

    function lineWords(line) {
        return (line.words || []).map(word => {
            const box = word.bbox || {};
            return {
                text: clean(word.text),
                left: box.left || 0,
                right: box.right || box.left || 0
            };
        }).filter(word => word.text).sort((a, b) => a.left - b.left);
    }

    function splitColumns(words) {
        let split = 1;
        let largestGap = -1;
        for (let i = 1; i < words.length; i++) {
            const gap = words[i].left - words[i - 1].right;
            if (gap > largestGap) {
                largestGap = gap;
                split = i;
            }
        }
        return [
            words.slice(0, split).map(word => word.text).join(" ").trim(),
            words.slice(split).map(word => word.text).join(" ").trim()
        ];
    }

    function parseLines(data) {
        const result = { ukeord: [], gloser: [] };
        const lines = data && Array.isArray(data.lines) ? data.lines : [];
        let tableStarted = false;
        let threeColumnTable = false;

        lines.forEach(line => {
            const words = lineWords(line);
            if (!words.length) return;
            const text = words.map(word => word.text).join(" ");
            const normalized = text.toLowerCase();

            // Ignore everything above the word table. This prevents text from
            // the lesson plan in the same screenshot becoming fake word pairs.
            if (/weekly\s+words?/i.test(text)) {
                tableStarted = true;
                threeColumnTable = false;
                return;
            }
            if (/^norsk\s+english\s+norwegian$/i.test(normalized)) {
                tableStarted = true;
                threeColumnTable = true;
                return;
            }
            if (!tableStarted || isLessonPlanText(text)) return;

            if (threeColumnTable) {
                // The three-column layout is: Norwegian spelling/weekly word,
                // English, Norwegian meaning. Keep both the ukeord and glosa.
                if (words.length >= 3) {
                    const ukeord = words[0].text;
                    const english = words[1].text;
                    const norwegian = words.slice(2).map(word => word.text).join(" ");
                    if (ukeord.length >= 2 && english.length >= 2 && norwegian.length >= 2) {
                        result.ukeord.push(ukeord);
                        result.gloser.push({ no: norwegian, en: english });
                    }
                }
                return;
            }

            // The two-column Weekly words layout has English on the left and
            // Norwegian on the right. The largest horizontal gap separates cells.
            if (words.length < 2) return;
            const [english, norwegian] = splitColumns(words);
            if (english.length < 2 || norwegian.length < 2) return;
            if (/^(weekly words|teased erta|words)$/i.test(`${english} ${norwegian}`)) return;
            result.gloser.push({ no: norwegian, en: english });
        });

        return {
            ukeord: [...new Set(result.ukeord.map(value => value.toLowerCase()))].map(value => result.ukeord.find(item => item.toLowerCase() === value)),
            gloser: uniqueEntries(result.gloser)
        };
    }

    function parsePlainText(data) {
        const text = String((data && data.text) || "");
        const result = [];
        let tableStarted = false;
        let threeColumnTable = false;

        text.split(/\r?\n/).forEach(line => {
            const cleanedLine = line.trim();
            if (/weekly\s+words?/i.test(cleanedLine)) {
                tableStarted = true;
                threeColumnTable = false;
                return;
            }
            if (/^norsk\s+english\s+norwegian$/i.test(cleanedLine)) {
                tableStarted = true;
                threeColumnTable = true;
                return;
            }
            if (!tableStarted || isLessonPlanText(cleanedLine)) return;

            const parts = cleanedLine.split(/\t+|\s{3,}/).map(clean).filter(Boolean);
            if (threeColumnTable && parts.length >= 3) {
                result.push({ no: parts.slice(2).join(" "), en: parts[1] });
            } else if (!threeColumnTable && parts.length >= 2) {
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

            const parsed = parseLines(result.data);
            let imported = parsed;
            if (!imported.ukeord.length && !imported.gloser.length) {
                const gloser = parsePlainText(result.data);
                imported = { ukeord: [], gloser };
            }
            if (!imported.ukeord.length && !imported.gloser.length) throw new Error("OCR fant ingen ordpar");

            mergeImported(imported);
            setCustomStatus(`Importert ${imported.ukeord.length} ukeord og ${imported.gloser.length} gloser. Sjekk gjerne ordene før du lagrer.`);
        } catch (error) {
            console.error(error);
            setCustomStatus("Fant ikke ordlisten. Beskjær rundt ukeord-/glosetabellen og prøv igjen.", true);
        } finally {
            event.target.value = "";
        }
    }

    // Capture phase prevents the older handler in script.js from processing the
    // same file a second time with its less table-aware parser.
    document.addEventListener("change", event => {
        if (event.target && event.target.id === "imageUploadInput") {
            event.stopImmediatePropagation();
            importImageFallback(event);
        }
    }, true);
})();
