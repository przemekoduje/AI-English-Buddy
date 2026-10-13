/**
 * sentenceGrouping.js
 * 
 * Zaawansowany moduł lingwistyczny zapewniający, że podział transkrypcji na segmenty/karty fraz
 * w Media Buddy następuje WYŁĄCZNIE na poziomie pełnych, logicznych zdań w języku angielskim.
 * 
 * Kluczowe filary:
 * 1. Zabezpieczenie przed urywaniem zdań w połowie (dangling words & phrases):
 *    Nigdy nie dopuszcza do zakończenia karty na przedimku (the, a), przyimku (of, to, with),
 *    spójniku (and, but, because), czasowniku posiłkowym, przymiotniku przydawkowym (big, important)
 *    ani liczebniku (two, ten). Chroni idiomy wielowyrazowe (you know, make sure, talking about, a lot of).
 * 2. Obsługa znaczników zmiany mówcy (>>):
 *    W napisach YouTube (szczególnie w wywiadach i podcastach) symbol '>>' oznacza zmianę rozmówcy.
 *    Moduł traktuje zmianę mówcy jako bezwzględną granicę nowego zdania i oczyszcza tekst z technicznych '>>'.
 * 3. Wychwytywanie zdań wewnątrz pojedynczych segmentów:
 *    Gdy segment YouTube zawiera kropkę w środku (np. "weekend. Well, you called"), zdania są natychmiast
 *    rozdzielane z zachowaniem proporcjonalnego czasu, co eliminuje zlepianie obcych myśli.
 * 4. Płynna obsługa mowy potocznej i zacięć (stammer carry-over):
 *    Gdy mówca kończy zdanie wiszącym spójnikiem (np. "...values are and | and basically AI..."),
 *    spójnik jest przenoszony na początek kolejnego zdania.
 * 5. Eliminacja sierocych kart (orphan card stitching):
 *    Krótkie wtrącenia i urwane zaimki (np. "You.", "I mean.") są zszywane z właściwym zdaniem.
 */

// Typowe skróty w języku angielskim zakończone kropką, które NIE kończą zdania
export const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "e.g.", "i.e.",
  "etc.", "st.", "u.s.", "u.k.", "gen.", "gov.", "jan.", "feb.", "mar.", "apr.",
  "jun.", "jul.", "aug.", "sept.", "oct.", "nov.", "dec.", "a.m.", "p.m.", "no.", "vol.", "ai.", "ceo."
]);

// Słowa, które BEZWZGLĘDNIE NIE MOGĄ zakończyć zdania (nawet jeśli transkrypcja zawiera tam kropkę)
export const STRICT_DANGLING_END_WORDS = new Set([
  // Przedimki i zaimki wskazujące/dzierżawcze
  "a", "an", "the", "my", "your", "his", "her", "its", "our", "their",
  "every", "each", "either", "neither", "another", "whose",

  // Czyste przyimki
  "of", "to", "for", "with", "at", "from", "into", "onto", "towards", "toward",
  "upon", "during", "without", "between", "among", "throughout", "despite", "unto",

  // Spójniki
  "and", "but", "or", "nor", "because", "although", "whereas", "unless",
  "until", "since", "whether", "than",

  // Zaimki względne
  "which", "whom"
]);

// Słowa, które w mowie bez interpunkcji wskazują na trwający, niedokończony fragment myśli
export const UNPUNCTUATED_DANGLING_WORDS = new Set([
  ...STRICT_DANGLING_END_WORDS,
  "this", "that", "these", "those", "some", "any", "no",
  "in", "on", "by", "about", "as", "like", "through", "after", "over", "out",
  "against", "before", "under", "around", "behind", "across", "within", "besides", "via", "per",
  "so", "if", "while", "though", "even",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "haven't", "hasn't", "hadn't", "isn't", "aren't", "wasn't", "weren't",
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "cannot",
  "couldn't", "shouldn't", "mightn't", "mustn't",
  "'s", "'re", "'ve", "'d", "'ll", "'m", "gonna", "wanna", "gotta",
  "what", "whatever", "whoever", "where", "when", "why", "how", "who",
  "very", "too", "quite", "more", "most", "such", "really", "extremely", "pretty", "fairly", "just", "only",
  // Liczebniki i określniki ilościowe
  "many", "much", "few", "fewer", "several", "all", "both", "lot", "lots", "tons", "plenty", "couple",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "first", "second", "third",
  // Przymiotniki przydawkowe (nie mogą kończyć zdania, jeśli po nich następuje rzeczownik)
  "big", "small", "good", "bad", "great", "new", "old", "real", "different", "important", "main",
  "huge", "major", "key", "hard", "easy", "high", "low", "early", "late", "whole", "entire",
  "specific", "general", "strong", "clear", "long", "short", "positive", "negative", "human", "social",
  "financial", "economic", "political", "personal", "open", "free", "true", "certain", "sure", "same",
  "able", "likely", "little", "large", "deep", "simple", "difficult", "fine", "nice",
  "cyber", "online", "digital", "meta", "tech",
  // Czasowniki przechodnie / łączące w trakcie frazy
  "talking", "talk", "making", "make", "made", "think", "thinking", "looking", "look", "going",
  "feel", "feeling", "call", "calling", "said", "say", "saying"
]);

// Wielowyrazowe frazy wiszące (nie wolno ich rozcinać w połowie)
export const DANGLING_PHRASES = [
  "such as", "as well as", "due to", "because of", "in order to",
  "so that", "as if", "as though", "going to", "want to", "have to",
  "has to", "had to", "used to", "out of", "instead of", "according to",
  "based on", "prior to", "next to", "up to", "kind of", "sort of",
  "type of", "a lot of", "lots of", "part of", "in terms of", "more of",
  "less of", "you know", "i mean", "as long as", "make sure", "making sure",
  "made sure", "point of view", "focus on", "rely on", "depend on",
  "talking about", "talk about", "think about", "thinking about",
  "stands for", "stand for", "as opposed to", "on top of", "ahead of", "in front of"
];

// Słowa, które NIE MOGĄ rozpoczynać nowego zdania (czasowniki bez podmiotu, partykuły zależne)
export const NON_STARTER_WORDS = new Set([
  "stands", "stand", "stood", "leads", "lead", "led", "connect", "connects", "connected",
  "creates", "create", "created", "means", "mean", "meant", "requires", "require",
  "depends", "depend", "shows", "show", "showed", "works", "work", "worked",
  "helps", "help", "helped", "allows", "allow", "allowed", "makes", "make", "made",
  "gives", "give", "gave", "takes", "take", "took", "brings", "bring", "brought",
  "about", "sure", "know", "possible", "widely", "than", "opposed", "including"
]);

// Prawidłowe słowa i frazy rozpoczynające nowe zdanie lub myśl w mowie angielskiej
export const SENTENCE_STARTERS = new Set([
  "so", "and", "but", "because", "or", "well", "now", "then", "also", "actually",
  "in fact", "plus", "anyway", "meanwhile", "however", "if", "when", "while",
  "although", "though", "since", "after", "before", "unless", "until",
  "i", "you", "we", "they", "he", "she", "it", "there", "that", "this", "these",
  "those", "what", "why", "how", "where", "who", "right", "okay", "sure", "yeah", "yes", "no"
]);

/**
 * Sprawdza, czy końcówka tekstu stanowi bezwzględnie niedozwolony koniec zdania
 */
export const hasStrictDanglingEnd = (text) => {
  if (!text) return false;
  const stripped = text.trim().replace(/[.,!?;:"'”’)\]]+$/, "").trim();
  if (!stripped) return false;
  const lower = stripped.toLowerCase();
  for (const phrase of ["such as", "due to", "because of", "in order to", "out of", "instead of"]) {
    if (lower.endsWith(phrase)) return true;
  }
  const words = lower.split(/\s+/);
  const lastWord = words[words.length - 1].replace(/[^a-z0-9']/g, "");
  return STRICT_DANGLING_END_WORDS.has(lastWord);
};

/**
 * Sprawdza, czy końcówka tekstu stanowi element łączący w mowie bez interpunkcji
 */
export const hasUnpunctuatedDanglingEnd = (text) => {
  if (!text) return false;
  const stripped = text.trim().replace(/[.,!?;:"'”’)\]]+$/, "").trim();
  if (!stripped) return false;
  const lower = stripped.toLowerCase();
  for (const phrase of DANGLING_PHRASES) {
    if (lower.endsWith(phrase)) return true;
  }
  const words = lower.split(/\s+/);
  const lastWord = words[words.length - 1].replace(/[^a-z0-9']/g, "");
  return UNPUNCTUATED_DANGLING_WORDS.has(lastWord);
};

/**
 * Sprawdza, czy dany fragment tekstu kończy pełne zdanie w języku angielskim.
 */
export const isSentenceEnd = (text) => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Samodzielne znaczniki dźwiękowe, np. (Laughter), [Music], (Applause)
  if ((trimmed.startsWith("(") && trimmed.endsWith(")")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }

  const stripped = trimmed.replace(/["'”’)\]]+$/, "");
  if (!stripped) return false;

  const lastChar = stripped[stripped.length - 1];
  if (lastChar === "." || lastChar === "?" || lastChar === "!") {
    const words = stripped.split(/\s+/);
    if (words.length === 0) return false;
    const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z0-9.']/g, "");

    // Skróty z kropką (np. dr., mr., e.g., ai., ceo.)
    if (ABBREVIATIONS.has(lastWord) || ABBREVIATIONS.has(lastWord.replace(/\.$/, ""))) {
      return false;
    }

    // Słowa wiszące, przed którymi omyłkowo postawiono kropkę (np. "seen the.")
    const cleanWord = lastWord.replace(/[.]+$/, "");
    if (STRICT_DANGLING_END_WORDS.has(cleanWord)) {
      return false;
    }

    if (hasStrictDanglingEnd(stripped.slice(0, -1))) {
      return false;
    }

    return true;
  }
  return false;
};

/**
 * Prawidłowo formatuje wielkość liter przy doklejaniu fragmentu do nieskończonego zdania.
 */
export const formatContinuation = (segText, prevText = "") => {
  if (!segText) return "";
  const parts = segText.split(/(\s+)/);
  const firstWord = parts[0];
  if (!firstWord) return segText;

  if (prevText) {
    const prevWords = prevText.trim().replace(/["'”’)\]]+$/, "").split(/\s+/);
    if (prevWords.length > 0) {
      const lastPrev = prevWords[prevWords.length - 1].toLowerCase();
      if (ABBREVIATIONS.has(lastPrev) || ABBREVIATIONS.has(lastPrev.replace(/\.$/, ""))) {
        return segText;
      }
    }
  }

  // Zaimek osobowy I oraz jego formy ściągnięte (I'm, I've, I'll, I'd)
  if (firstWord === "I" || /^I['’]/.test(firstWord)) return segText;

  // Akronimy (np. AI, NASA, USA, CEO)
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase() && /^[A-Z0-9]+$/.test(firstWord)) {
    return segText;
  }

  parts[0] = firstWord.charAt(0).toLowerCase() + firstWord.slice(1);
  return parts.join("");
};

/**
 * Czyści surowy tekst: usuwa znaczniki >>, normalizuje spacje i usuwa artefakty interpunkcyjne.
 */
const cleanRawText = (text) => {
  if (!text) return "";
  return text
    .replace(/>>+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,;:\-]+([.?!])/g, "$1") // eliminuje np. ",." lub "-."
    .trim();
};

/**
 * Dzieli długą, niepunktowaną frazę na naturalne, pełne jednostki zdań/myśli.
 */
export const splitLongUnpunctuatedClause = (text) => {
  if (!text) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  
  if (words.length <= 22) {
    let s = cleanRawText(words.join(" "));
    s = s.replace(/[,;:\-]+$/, "").trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
    return [s];
  }

  const results = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i]);
    const count = currentWords.length;
    const remaining = words.length - (i + 1);

    if (count >= 12 && remaining >= 5) {
      const nextWord = (words[i + 1] || "").toLowerCase().replace(/[^a-z']/g, "");
      const nextTwoWords = words[i + 2] 
        ? `${nextWord} ${(words[i + 2] || "").toLowerCase().replace(/[^a-z']/g, "")}` 
        : "";

      const isStarter = SENTENCE_STARTERS.has(nextWord) || SENTENCE_STARTERS.has(nextTwoWords);
      const isInvalid = NON_STARTER_WORDS.has(nextWord);
      const currLast = (words[i] || "").toLowerCase().replace(/[^a-z']/g, "");
      const isCurrDangling = UNPUNCTUATED_DANGLING_WORDS.has(currLast);

      if (!isCurrDangling && !isInvalid && ((count >= 12 && isStarter) || count >= 20)) {
        let sent = cleanRawText(currentWords.join(" "));
        sent = sent.replace(/[,;:\-]+$/, "").trim();
        sent = sent.charAt(0).toUpperCase() + sent.slice(1);
        if (!/[.?!]["'”’)]?$/.test(sent)) sent += ".";
        results.push(sent);
        currentWords = [];
      }
    }
  }

  if (currentWords.length > 0) {
    let sent = cleanRawText(currentWords.join(" "));
    sent = sent.replace(/[,;:\-]+$/, "").trim();
    if (results.length > 0 && currentWords.length < 5) {
      let prev = results[results.length - 1];
      if (prev.endsWith(".")) prev = prev.slice(0, -1);
      results[results.length - 1] = `${prev} ${formatContinuation(sent, prev)}.`;
    } else {
      sent = sent.charAt(0).toUpperCase() + sent.slice(1);
      if (!/[.?!]["'”’)]?$/.test(sent)) sent += ".";
      results.push(sent);
    }
  }

  return results;
};

/**
 * Dzieli pojedynczy blok tekstu na tablicę pełnych zdań.
 */
export const splitBlockIntoSentences = (text) => {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const regex = /(.+?[.?!]["'”’)]?)(?:\s+(?=[A-Z0-9"'“(])|$)/g;
  const matches = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    if (match[1]) matches.push(match[1].trim());
  }

  const rawPieces = matches.length === 0 ? [trimmed] : [];
  if (matches.length > 0) {
    let buffer = "";
    for (const m of matches) {
      const candidate = buffer ? `${buffer} ${m}` : m;
      if (!isSentenceEnd(candidate)) {
        buffer = candidate;
        continue;
      }
      rawPieces.push(candidate);
      buffer = "";
    }
    if (buffer) {
      if (rawPieces.length > 0) {
        rawPieces[rawPieces.length - 1] += ` ${buffer}`;
      } else {
        rawPieces.push(buffer);
      }
    }
  }

  const finalSentences = [];
  for (const piece of rawPieces) {
    const words = piece.split(/\s+/).filter(Boolean);
    if (words.length > 24) {
      finalSentences.push(...splitLongUnpunctuatedClause(piece));
    } else {
      let s = cleanRawText(piece);
      s = s.replace(/[,;:\-]+$/, "").trim();
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
      finalSentences.push(s);
    }
  }

  return finalSentences;
};

/**
 * Główna funkcja normalizująca dowolną tablicę segmentów transkrypcji [{start, end, text}].
 * Zapewnia:
 * 1. Każdy zwrócony element reprezentuje DOKŁADNIE JEDNO PEŁNE ZDANIE o naturalnej długości.
 * 2. Znacznik 'start' odpowiada rzeczywistemu momentowi rozpoczęcia zdania.
 * 3. Zmiany mówcy (>>) stanowią naturalne granice nowych zdań bez zaśmiecania tekstu znakami >>.
 * 4. Frazy zacięte na spójnikach są naturalnie przenoszone na początek kolejnej myśli.
 * 5. Żadne przymiotniki, liczebniki, przedimki ani idiomy nie zostają ucięte na końcu karty.
 */
export const ensureCompleteSentences = (rawTranscript) => {
  if (!Array.isArray(rawTranscript) || rawTranscript.length === 0) {
    return [];
  }

  // Filtrujemy puste segmenty oraz nagłówki techniczne transkrybentów
  const cleaned = rawTranscript.filter(seg => {
    if (!seg || !seg.text) return false;
    const t = seg.text.trim();
    if (!t) return false;
    if (t.includes("Transcriber:") && t.includes("Reviewer:")) return false;
    return true;
  });

  if (cleaned.length === 0) return [];

  // Faza 1: Wstępna normalizacja i pre-splitting segmentów z wewnętrzną kropką
  // Eliminuje problem ignorowania kropek znajdujących się w środku segmentu ASR.
  const preprocessed = [];
  for (const seg of cleaned) {
    const isSpeaker = seg.text.includes(">>");
    const cleanedText = cleanRawText(seg.text);
    if (!cleanedText) continue;

    // Szukamy wewnętrznych zakończeń zdań: [.?!] poprzedzających spację i wielką literę
    const regex = /(.+?[.?!]["'”’)]?)(?:\s+(?=[A-Z0-9"'“(])|$)/g;
    let match;
    let lastIndex = 0;
    const parts = [];
    while ((match = regex.exec(cleanedText)) !== null) {
      if (match[1]) {
        parts.push(match[1].trim());
        lastIndex = regex.lastIndex;
      }
    }
    if (lastIndex < cleanedText.length) {
      const rem = cleanedText.slice(lastIndex).trim();
      if (rem) parts.push(rem);
    }

    if (parts.length > 1) {
      const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
      const dur = Math.max(0, seg.end - seg.start);
      let cStart = seg.start;
      for (let pIdx = 0; pIdx < parts.length; pIdx++) {
        const p = parts[pIdx];
        const frac = totalLen > 0 ? p.length / totalLen : 1 / parts.length;
        const cEnd = pIdx === parts.length - 1 ? seg.end : cStart + frac * dur;
        preprocessed.push({
          start: Math.round(cStart * 100) / 100,
          end: Math.round(cEnd * 100) / 100,
          text: p,
          isSpeaker: pIdx === 0 ? isSpeaker : false
        });
        cStart = cEnd;
      }
    } else {
      preprocessed.push({
        start: seg.start,
        end: seg.end,
        text: cleanedText,
        isSpeaker
      });
    }
  }

  // Faza 2: Inteligentne łączenie i wyznaczanie granic zdań
  const cards = [];
  let curr = null;

  for (let i = 0; i < preprocessed.length; i++) {
    const seg = preprocessed[i];
    if (!curr) {
      curr = {
        start: seg.start,
        end: seg.end,
        text: seg.text,
        wordCount: seg.text.split(/\s+/).length,
        isSpeaker: seg.isSpeaker
      };
      continue;
    }

    const prevText = curr.text;
    const prevWords = curr.wordCount;
    const gap = seg.start - curr.end;
    const wordsInSeg = seg.text.split(/\s+/);
    const nextFirstWord = (wordsInSeg[0] || "").toLowerCase().replace(/[^a-z']/g, "");
    const nextTwoWords = wordsInSeg.slice(0, 2).join(" ").toLowerCase().replace(/[^a-z' ]/g, "");
    const endsPunc = isSentenceEnd(prevText);
    const isDangling = hasUnpunctuatedDanglingEnd(prevText);
    const isStrictDangling = hasStrictDanglingEnd(prevText);
    const isInvalidStarter = NON_STARTER_WORDS.has(nextFirstWord);

    // Wyjątkowa reguła dla "as": tylko "as we", "as I", "as you" rozpoczynają zdanie
    const isAsModifier = nextFirstWord === "as" && !["we", "i", "you", "they", "he", "she", "it"].includes((wordsInSeg[1] || "").toLowerCase());

    let shouldSplit = false;
    if (seg.isSpeaker) {
      // Zmiana rozmówcy w wywiadzie/podcaście
      shouldSplit = true;
    } else if (endsPunc && !isStrictDangling) {
      // Gramatyczny koniec zdania interpunkcją
      shouldSplit = true;
    } else if (!isDangling && !isInvalidStarter && !isAsModifier) {
      if (gap >= 0.8 && prevWords >= 7) {
        // Naturalna pauza po min. 7 słowach
        shouldSplit = true;
      } else if (prevWords >= 12 && (SENTENCE_STARTERS.has(nextFirstWord) || SENTENCE_STARTERS.has(nextTwoWords))) {
        // Nowa fraza/myśl rozpoczynająca się od spójnika lub zaimka podmiotu
        shouldSplit = true;
      } else if (prevWords >= 22) {
        // Bezpieczny limit słów dla niepunktowanej mowy (tylko na bezpiecznym słowie)
        shouldSplit = true;
      }
    }

    // Obsługa zacięć na spójnikach (stammer carry-over):
    // Jeśli fraza osiągnęła min. 14 słów i kończy się spójnikiem (and/but/so/or),
    // przenieś go na początek kolejnej karty zamiast tworzyć zdanie wiszące!
    let carryOverWord = "";
    if (!shouldSplit && prevWords >= 14 && (SENTENCE_STARTERS.has(nextFirstWord) || SENTENCE_STARTERS.has(nextTwoWords))) {
      const matchConj = prevText.match(/\s+(and|but|so|or)\s*$/i);
      if (matchConj) {
        carryOverWord = matchConj[1];
        shouldSplit = true;
      }
    }

    if (shouldSplit) {
      let s = curr.text.trim();
      if (carryOverWord) {
        s = s.slice(0, s.lastIndexOf(carryOverWord)).trim();
      }
      s = cleanRawText(s);
      s = s.replace(/[,;:\-]+$/, "").trim();
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
      curr.text = s;
      cards.push(curr);

      let startText = seg.text;
      if (carryOverWord) {
        const capitalizedConj = carryOverWord.charAt(0).toUpperCase() + carryOverWord.slice(1).toLowerCase();
        startText = `${capitalizedConj} ${startText}`;
      }
      curr = {
        start: seg.start,
        end: seg.end,
        text: startText,
        wordCount: startText.split(/\s+/).length,
        isSpeaker: seg.isSpeaker
      };
    } else {
      curr.end = Math.max(curr.end, seg.end);
      let cleanPrev = curr.text.trim();
      if (isStrictDangling) {
        cleanPrev = cleanPrev.replace(/[.,;:]+$/, "");
      }
      const contText = (!endsPunc || isStrictDangling) ? formatContinuation(seg.text, cleanPrev) : seg.text;
      if (cleanPrev.endsWith("-") || contText.startsWith("'")) {
        curr.text = `${cleanPrev}${contText}`;
      } else {
        curr.text = `${cleanPrev} ${contText}`;
      }
      curr.wordCount = curr.text.split(/\s+/).length;
    }
  }

  // Zamknięcie ostatniej karty
  if (curr) {
    let s = cleanRawText(curr.text);
    s = s.replace(/[,;:\-]+$/, "").trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
    curr.text = s;
    cards.push(curr);
  }

  // Faza 3: Finałowy pass stitching (zszywanie sierocych wtrąceń i słów wiszących)
  const polished = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const words = c.text.split(/\s+/).filter(Boolean);

    // Jeśli karta ma <= 2 słowa (np. "You know.", "I mean.", "Um.") i nie jest samodzielną zmianą mówcy
    if (words.length <= 2 && i < cards.length - 1 && !cards[i + 1].isSpeaker) {
      cards[i + 1].start = c.start;
      const prefix = c.text.replace(/[.?!]+$/, "").trim();
      const nextFirst = cards[i + 1].text.charAt(0).toLowerCase() + cards[i + 1].text.slice(1);
      cards[i + 1].text = `${prefix}, ${nextFirst}`;
    } else if (i < cards.length - 1 && hasStrictDanglingEnd(c.text)) {
      const next = cards[i + 1];
      let cleanCurr = c.text.replace(/[.,;:]+$/, "");
      let nextText = formatContinuation(next.text, cleanCurr);
      cards[i + 1] = {
        start: c.start,
        end: next.end,
        text: `${cleanCurr} ${nextText}`,
        wordCount: `${cleanCurr} ${nextText}`.split(/\s+/).length,
        isSpeaker: c.isSpeaker
      };
    } else {
      polished.push({
        start: Math.round(c.start * 100) / 100,
        end: Math.round(c.end * 100) / 100,
        text: c.text
      });
    }
  }

  return polished;
};

export default ensureCompleteSentences;
