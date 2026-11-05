// Deterministic English syntax & grammatical construction detector
// Detects inversions, correlative structures, hypothetical clauses, and high-value sentence patterns

const AUX_VERBS = "(?:did|do|does|was|were|is|are|am|had|have|has|can|could|will|would|shall|should|may|might|must)";
const SUBJECT_PRONOUNS = "(?:i|you|he|she|it|we|they|there|one|anyone|anybody|someone|somebody|everyone|everybody|nobody|this|that|these|those|the\\s+[a-z]+|his\\s+[a-z]+|her\\s+[a-z]+|their\\s+[a-z]+|our\\s+[a-z]+|my\\s+[a-z]+|[a-z]+)";

const SYNTAX_RULES = [
  {
    id: "inversion_nor_neither",
    regex: new RegExp(`\\b(nor|neither)\\s+(${AUX_VERBS})\\s+(${SUBJECT_PRONOUNS})(?:\\s+([a-z]+(?:\\s+[a-z]+)?))?`, "i"),
    type: "Składnia · Inwersja po 'nor / neither'",
    buildPattern: (m) => `${m[1].toLowerCase()} + [operator: ${m[2].toLowerCase()}] + [osoba] + [czasownik]`,
    translation: "ani też (ktoś) nie... / i również nie...",
    explanation: "Po słowach przeczących „nor” oraz „neither” stosujemy inwersję (szyk jak w pytaniu): operator (np. did, was, can, have) stawiamy PRZED osobą, a czasownik główny zostaje w formie podstawowej (bez dodatkowego „not”).",
    example: "He didn't apologize, nor did he explain why. — Nie przeprosił, ani też nie wyjaśnił dlaczego."
  },
  {
    id: "inversion_not_only",
    regex: new RegExp(`\\b(not\\s+only)\\s+(${AUX_VERBS})\\s+(${SUBJECT_PRONOUNS})(?:\\s+([a-z]+))?`, "i"),
    type: "Składnia · Inwersja emfatyczna",
    buildPattern: (m) => `Not only + [operator: ${m[2].toLowerCase()}] + [osoba] + [czasownik]..., (but also...)`,
    translation: "nie tylko..., ale również... (z mocnym akcentem)",
    explanation: "Gdy zdanie lub człon zaczyna się od „Not only”, w pierwszej części stosujemy szyk pytający (inwersję) — operator stawiamy przed osobą, aby podkreślić wagę wypowiedzi.",
    example: "Not only did she finish early, but she also helped others. — Nie dość, że skończyła wcześniej, to jeszcze pomogła innym."
  },
  {
    id: "inversion_little_did",
    regex: new RegExp(`\\b(little)\\s+(did|do|does|had|would|could)\\s+(${SUBJECT_PRONOUNS})\\s+(know|realize|realise|think|suspect|imagine|expect|dream|guess)`, "i"),
    type: "Składnia · Inwersja z 'Little'",
    buildPattern: (m) => `Little ${m[2].toLowerCase()} + [osoba] + ${m[4].toLowerCase()}...`,
    translation: "nawet nie przypuszczał(a) / nie miał(a) pojęcia, że...",
    explanation: "Konstrukcja „Little did [ktoś] know / realize” oznacza, że ktoś zupełnie nie zdawał sobie sprawy z tego, co nastąpi. Po „Little” na początku zdania obowiązuje szyk pytający.",
    example: "Little did he know what awaited him. — Nie miał pojęcia, co go czeka."
  },
  {
    id: "inversion_no_sooner",
    regex: new RegExp(`\\b(no\\s+sooner)\\s+(had|did)\\s+(${SUBJECT_PRONOUNS})\\s+([a-z]+)(?:[^.!?]*?\\b(than)\\b)?`, "i"),
    type: "Składnia · Inwersja czasowa",
    buildPattern: () => "No sooner + had + [osoba] + [III forma czasownika] ... than ...",
    translation: "ledwie co..., gdy...",
    explanation: "Wyrażenie „No sooner... than...” opisuje czynność, po której natychmiast wydarzyła się kolejna. Wymaga szyku pytającego (zazwyczaj „had” przed osobą) oraz spójnika „than”.",
    example: "No sooner had he sat down than the phone rang. — Ledwie usiadł, gdy zadzwonił telefon."
  },
  {
    id: "inversion_hardly_scarcely",
    regex: new RegExp(`\\b(hardly|scarcely|barely)\\s+(had|did)\\s+(${SUBJECT_PRONOUNS})\\s+([a-z]+)(?:[^.!?]*?\\b(when|before)\\b)?`, "i"),
    type: "Składnia · Inwersja czasowa",
    buildPattern: (m) => `${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} + had + [osoba] + [III forma] ... when ...`,
    translation: "zaledwie / ledwo co..., kiedy...",
    explanation: "Konstrukcja „Hardly / Scarcely had... when...” podkreśla, że jedno zdarzenie nastąpiło ułamek sekundy po drugim. Po przysłówku na początku zdania operator „had” stawiamy przed osobą.",
    example: "Hardly had I closed my eyes when the alarm went off. — Ledwie zamknąłem oczy, kiedy zadzwonił budzik."
  },
  {
    id: "inversion_negative_adverbs",
    regex: new RegExp(`\\b(never|seldom|rarely|under\\s+no\\s+circumstances|on\\s+no\\s+account|in\\s+no\\s+way)\\s+(${AUX_VERBS})\\s+(${SUBJECT_PRONOUNS})\\s+([a-z]+)`, "i"),
    type: "Składnia · Inwersja po przysłówku przeczącym",
    buildPattern: (m) => `${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} + [operator: ${m[2].toLowerCase()}] + [osoba] + [czasownik]`,
    translation: "nigdy / rzadko kiedy / pod żadnym pozorem...",
    explanation: "Postawienie słów takich jak „Never”, „Rarely”, „Seldom” na początku zdania wymaga inwersji (operator przed osobą), co nadaje zdaniu wyrazisty, literacki lub perswazyjny ton.",
    example: "Never have I seen such determination. — Nigdy w życiu nie widziałem takiej determinacji."
  },
  {
    id: "inversion_only_after_when",
    regex: new RegExp(`\\b(only\\s+then|only\\s+later|only\\s+recently|only\\s+by\\s+[a-z]+ing|not\\s+until\\s+[^,]+)\\s+(${AUX_VERBS})\\s+(${SUBJECT_PRONOUNS})\\s+([a-z]+)`, "i"),
    type: "Składnia · Inwersja po 'Only / Not until'",
    buildPattern: (m) => `Only [...] / Not until [...] + [${m[2].toLowerCase()}] + [osoba] + [czasownik]`,
    translation: "dopiero wtedy / dopiero gdy...",
    explanation: "Gdy zdanie rozpoczyna się od „Only then”, „Only after...”, „Only by...” lub „Not until...”, w głównej części zdania stosujemy szyk pytający (operator przed podmiotem).",
    example: "Only then did I understand what she meant. — Dopiero wtedy zrozumiałem, co miała na myśli."
  },
  {
    id: "conditional_inversion_had",
    regex: new RegExp(`(?:^|[,;]\\s*)\\b(had)\\s+(it\\s+not\\s+been\\s+for|${SUBJECT_PRONOUNS}\\s+(?:not\\s+)?(?:known|seen|been|done|gone|had|taken|made|come|left|stayed|listened|realized|thought|asked|told|arrived|[a-z]+ed))\\b`, "i"),
    type: "Składnia · Inwersja warunkowa (bez 'if')",
    buildPattern: () => "Had + [osoba] + [III forma czasownika]... (zamiast: If + osoba + had...)",
    translation: "gdyby (ktoś)... / gdyby nie...",
    explanation: "W eleganckim języku angielskim w III okresie warunkowym można pominąć „if”, przenosząc „Had” na początek zdania przed osobę.",
    example: "Had I known earlier, I would have helped you. — Gdybym wiedział wcześniej, pomógłbym ci."
  },
  {
    id: "conditional_inversion_were_should",
    regex: new RegExp(`(?:^|[,;]\\s*)\\b(were\\s+it\\s+not\\s+for|should\\s+you\\s+(?:need|have|require|wish|want|decide))\\b`, "i"),
    type: "Składnia · Inwersja warunkowa (formalna)",
    buildPattern: () => "Were it not for... / Should you + [czasownik]...",
    translation: "gdyby nie... / w razie gdybyś potrzebował...",
    explanation: "Zamiast „If it weren't for” lub „If you should need” w formalnym angielskim stosujemy inwersję z „Were” lub „Should” na początku zdania.",
    example: "Should you have any questions, feel free to ask. — W razie jakichkolwiek pytań, śmiało pytaj."
  },
  {
    id: "double_comparative_the_more",
    regex: /\b(the\s+(?:more|less|fewer|better|worse|harder|faster|longer|sooner|higher|lower|older|closer|[a-z]+er)\b[^,;.!?]{1,45},\s*the\s+(?:more|less|fewer|better|worse|harder|faster|longer|sooner|higher|lower|older|closer|[a-z]+er))\b/i,
    type: "Składnia · Podwójny stopień wyższy",
    buildPattern: () => "The + [stopień wyższy], the + [stopień wyższy]",
    translation: "im bardziej..., tym bardziej...",
    explanation: "Konstrukcja „The more..., the more...” wyraża zależność przyczynowo-skutkową: im bardziej zmienia się jedna rzecz, tym bardziej zmienia się druga.",
    example: "The more you practice, the easier it gets. — Im więcej ćwiczysz, tym staje się to łatwiejsze."
  },
  {
    id: "as_if_past_subjunctive",
    regex: new RegExp(`\\b(as\\s+if|as\\s+though)\\s+(${SUBJECT_PRONOUNS})\\s+(could|would|were|had|knew|owned|wanted|needed|felt|understood|did|didn't|[a-z]+ed)\\b`, "i"),
    type: "Składnia · Porównanie hipotetyczne (as if / as though)",
    buildPattern: (m) => `${m[1].toLowerCase()} + [osoba] + [czas przeszły: ${m[3].toLowerCase()}]`,
    translation: "tak, jakby... (hipoteza / wyobrażenie)",
    explanation: "Po zwrotach „as if” oraz „as though” używamy czasu przeszłego (Past Simple / could / were), aby zaznaczyć, że sytuacja jest tylko porównaniem lub hipotezą, a nie dosłownym faktem.",
    example: "It was as if the AI could read his thoughts. — To było tak, jakby AI potrafiło czytać w jego myślach."
  },
  {
    id: "would_rather_had_better",
    regex: /\b((?:would|'d)\s+rather\s+(?:not\s+)?[a-z]+(?:\s+[^.!?]*?\bthan\s+[a-z]+)?|(?:had|'d)\s+better\s+(?:not\s+)?[a-z]+)\b/i,
    type: "Składnia · Konstrukcja 'would rather / had better'",
    buildPattern: () => "would rather + [czasownik podstawowy] (+ than...) / had better + [czasownik podstawowy]",
    translation: "wolałby(m) raczej... / lepiej żeby(ś)...",
    explanation: "Po wyrażeniach „would rather” (woleć) oraz „had better” (lepiej coś zrobić) czasownik główny występuje zawsze w czystej formie podstawowej (bez „to”).",
    example: "I would rather ask a question than stay quiet. — Wolałbym zadać pytanie niż milczeć."
  },
  {
    id: "high_time_past",
    regex: new RegExp(`\\b(it(?:'s|\\s+is|\\s+was)\\s+(?:high\\s+|about\\s+)?time)\\s+(${SUBJECT_PRONOUNS})\\s+([a-z]+ed|went|left|started|took|made|got|found|knew|told|spoke|did|came|began)\\b`, "i"),
    type: "Składnia · Konstrukcja 'It's high time'",
    buildPattern: () => "It's (high / about) time + [osoba] + [czasownik w Past Simple]",
    translation: "najwyższy czas, żeby (ktoś coś zrobił)",
    explanation: "Mimo że mówimy o teraźniejszości lub przyszłości, po zwrocie „It's high time” + osoba stawiamy czasownik w czasie przeszłym (Past Simple).",
    example: "It's high time we went home. — Najwyższy czas, żebyśmy poszli do domu."
  },
  {
    id: "instead_of_rather_than_gerund",
    regex: /\b((?:instead\s+of|rather\s+than)\s+[a-z]+ing(?:\s+[a-z]+)?)\b/i,
    type: "Składnia · Przyimek + forma -ing (Gerund)",
    buildPattern: () => "instead of / rather than + [czasownik z końcówką -ing]",
    translation: "zamiast (robić coś)...",
    explanation: "Po wyrażeniach „instead of” oraz „rather than” czasownik przyjmuje formę z końcówką -ing (tzw. Gerund), odpowiadającą polskiemu bezokolicznikowi po słowie „zamiast”.",
    example: "Instead of apologising, she asked a question. — Zamiast przepraszać, zadała pytanie."
  },
  {
    id: "correlative_neither_nor",
    regex: /\b(neither\s+[^,;.!?]{1,30}\s+nor\s+[a-z0-9'\s]{1,25})\b/i,
    type: "Składnia · Spójniki parzyste (neither... nor...)",
    buildPattern: () => "neither + [element A] + nor + [element B]",
    translation: "ani [A], ani [B]",
    explanation: "Konstrukcja „neither... nor...” łączy dwa elementy w zdaniu przeczącym. Ponieważ w języku angielskim nie ma podwójnego przeczenia, czasownik w takim zdaniu pozostaje w formie twierdzącej.",
    example: "She likes neither coffee nor tea. — Nie lubi ani kawy, ani herbaty."
  },
  {
    id: "used_to_habit",
    regex: /\b((?:(?:am|is|are|was|were|get|got|getting|become|became)\s+used\s+to\s+[a-z]+ing)|(?:used\s+to\s+(?:be|have|do|go|live|work|play|think|say|make|take|see|come|know|get|feel|[a-z]+)))\b/i,
    type: "Składnia · Konstrukcja 'used to / be used to'",
    buildPattern: () => "be/get used to + [czasownik -ing] (przywyknąć) LUB used to + [bezokolicznik] (zwykło się dawniej)",
    translation: "być przyzwyczajonym do... / mieć w zwyczaju (kiedyś)...",
    explanation: "„Used to + bezokolicznik” opisuje dawne nawyki z przeszłości (już nieaktualne), natomiast „be/get used to + -ing” oznacza bycie przyzwyczajonym lub przyzwyczajanie się do czegoś.",
    example: "I used to live here, so I am used to waking up early. — Kiedyś tu mieszkałem, więc jestem przyzwyczajony do wczesnego wstawania."
  },
  {
    id: "so_such_that_result",
    regex: /\b((?:so\s+[a-z]+(?:\s+[a-z]+)?|such\s+(?:a|an)?\s*[a-z]+\s+[a-z]+)\s+that\s+(?:i|you|he|she|it|we|they|there|[a-z]+))\b/i,
    type: "Składnia · Konstrukcja skutkowa 'so / such ... that'",
    buildPattern: () => "so + [przymiotnik/przysłówek] + that... / such + (a/an) + [przymiotnik + rzeczownik] + that...",
    translation: "tak (bardzo)..., że...",
    explanation: "„So” łączymy z samym przymiotnikiem lub przysłówkiem (np. so fast that...), a „such” z rzeczownikiem (np. such a good book that...), aby wyrazić skutek.",
    example: "It was so cold that the lake froze. — Było tak zimno, że jezioro zamarzło."
  }
];

export function detectSentenceSyntax(sentence, clickedWord = "") {
  if (!sentence || typeof sentence !== "string") return null;
  const cleanSentence = sentence.trim();
  if (!cleanSentence) return null;

  const lowerWord = (clickedWord || "").replace(/[^a-zA-Z'-]/g, "").toLowerCase();
  const matches = [];

  for (const rule of SYNTAX_RULES) {
    const match = cleanSentence.match(rule.regex);
    if (match && match[0]) {
      const matchedPhrase = match[0].trim().replace(/[.,!?;:]+$/, "");
      const pattern = typeof rule.buildPattern === "function" ? rule.buildPattern(match) : rule.pattern;
      const wordInMatch = lowerWord && matchedPhrase.toLowerCase().split(/[^a-z'-]+/).includes(lowerWord);
      matches.push({
        id: rule.id,
        chunk: matchedPhrase,
        type: rule.type,
        pattern,
        translation: rule.translation,
        explanation: rule.explanation,
        example: rule.example,
        isClickedWordPart: Boolean(wordInMatch)
      });
    }
  }

  if (matches.length === 0) return null;
  // Prefer the rule where the clicked word itself is part of the matched syntax phrase
  const directHit = matches.find((m) => m.isClickedWordPart);
  return directHit || matches[0];
}

