const ukeord = [
    "sjokolade",
    "kjøkken",
    "familie",
    "sykkel",
    "håndkle",
    "vennskap"
];

const gloser = [
    { no: "hund", en: "dog" },
    { no: "katt", en: "cat" },
    { no: "hus", en: "house" },
    { no: "bil", en: "car" },
    { no: "bok", en: "book" },
    { no: "skole", en: "school" }
];

let selectedMode = "";
let questions = [];
let currentQuestion = 0;
let score = 0;

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function startGame(mode) {
    selectedMode = mode;
    score = 0;
    currentQuestion = 0;

    if (mode === "ukeord") {
        questions = shuffle([...ukeord]);
    } else {
        questions = shuffle([...gloser]);
    }

    document.getElementById("score").innerText = score;
    document.getElementById("game").classList.remove("hidden");

    showQuestion();
}

function showQuestion() {
    document.getElementById("answer").value = "";
    document.getElementById("feedback").innerHTML = "";

    document.getElementById("progress").innerText =
        `${currentQuestion + 1} / ${questions.length}`;

    if (selectedMode === "ukeord") {
        document.getElementById("question").innerHTML =
            `Skriv ordet:<br><br><b>${questions[currentQuestion]}</b>`;
    } else {
        document.getElementById("question").innerHTML =
            `Hva er engelsk for:<br><br><b>${questions[currentQuestion].no}</b>`;
    }
}

function checkAnswer() {
    let answer =
        document.getElementById("answer")
            .value
            .trim()
            .toLowerCase();

    let correctAnswer;

    if (selectedMode === "ukeord") {
        correctAnswer = questions[currentQuestion].toLowerCase();
    } else {
        correctAnswer = questions[currentQuestion].en.toLowerCase();
    }

    const feedback = document.getElementById("feedback");

    if (answer === correctAnswer) {
        score++;
        document.getElementById("score").innerText = score;

        feedback.className = "correct";
        feedback.innerHTML = "✅ Riktig!";
    } else {
        feedback.className = "wrong";
        feedback.innerHTML =
            `❌ Feil<br>Riktig svar: ${correctAnswer}`;
    }

    currentQuestion++;

    if (currentQuestion < questions.length) {
        setTimeout(() => {
            showQuestion();
        }, 1500);
    } else {
        setTimeout(() => {
            showResult();
        }, 1500);
    }
}

function showResult() {
    let max = questions.length;

    document.getElementById("question").innerHTML = "🏆 Ferdig!";

    document.getElementById("feedback").innerHTML =
        `Du fikk ${score} av ${max} poeng!`;

    document.getElementById("progress").innerHTML = "Fullført";

    if (score === max) {
        document.getElementById("feedback").innerHTML +=
            "<br><br>🎉 Fantastisk! 🎉";
    }
}

document.getElementById("checkBtn").addEventListener("click", checkAnswer);

document.getElementById("answer").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        checkAnswer();
    }
});
