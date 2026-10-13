/**
 * sentenceGrouping.js
 * 
 * Zaawansowany moduł lingwistyczny zapewniający, że podział transkrypcji na segmenty/karty fraz
 * w Media Buddy następuje WYŁĄCZNIE na poziomie pełnych, logicznych zdań w języku angielskim.
 * 
 * 1. Zabezpieczenie przed urywaniem zdań w połowie (dangling words):
 *    Nigdy nie dopuszcza do zakończenia karty na przedimku (the, a), przyimku (of, to, with),
 *    spójniku (and, but, because) czy czasowniku posiłkowym, nawet jeśli surowa transkrypcja
 *    YouTube posiadała tam pauzę w mowie lub błędną kropkę.
 * 2. Precyzyjne wyrównanie znaczników czasu (timestamp alignment):
 *    Znacznik czasu 'start' reprezentuje DOKŁADNY początek całego zdania, a 'end' - koniec.
 *    Eliminuje to odrębne, bezsensowne karty w środku wypowiedzi (np. "We haven't seen the." i "Models yet.").
 * 3. Inteligentne łączenie i formatowanie:
 *    Gdy fragmenty są łączone w jedno zdanie, automatycznie korygowana jest wielkość liter
 *    (np. "the" + "Models yet" -> "the models yet"), z poszanowaniem zaimka "I", akronimów
 *    oraz nazw własnych po tytulaturze (Dr., Mr., Prof.).
 * 4. Płynna obsługa mowy bez interpunkcji (automatyczne napisy YouTube):
 *    Dzieli długie potoki mowy na naturalne, gramatyczne jednostki składniowe (10-18 słów)
 *    z proporcjonalnym podziałem czasu.
 */

// Typowe skróty w języku angielskim zakończone kropką, które NIE kończą zdania
export const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "e.g.", "i.e.",
  "etc.", "st.", "u.s.", "u.k.", "gen.", "gov.", "jan.", "feb.", "mar.", "apr.",
  "jun.", "jul.", "aug.", "sept.", "oct.", "nov.", "dec.", "a.m.", "p.m.", "no.", "vol."
]);

// Słowa, które BEZWZGLĘDNIE NIE MOGĄ zakończyć zdania (nawet jeśli transkrypcja zawiera tam kropkę)
export const STRICT_DANGLING_END_WORDS = new Set([
  // Przedimki i zaimki wskazujące/dzierżawcze
  "a", "an", "the", "my", "your", "his", "her", "its", "our", "their",
  "every", "each", "either", "neither", "another",

  // Czyste przyimki
  "of", "to", "for", "with", "at", "from", "into", "onto", "towards", "toward",
  "upon", "during", "without", "between", "among", "throughout", "despite", "unto",

  // Spójniki
  "and", "but", "or", "nor", "because", "although", "whereas", "unless",
  "until", "since", "whether", "than",

  // Zaimki względne
  "which", "whom", "whose"
]);

// Słowa, które w mowie bez interpunkcji wskazują na trwający, niedokończony fragment myśli
export const UNPUNCTUATED_DANGLING_WORDS = new Set([
  ...STRICT_DANGLING_END_WORDS,
  "this", "that", "these", "those", "some", "any", "no",
  "in", "on", "by", "about", "as", "like", "through", "after", "over", "out",
  "against", "before", "under", "around", "behind", "across", "within", "besides",
  "so", "if", "while", "though", "even",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "haven't", "hasn't", "hadn't", "isn't", "aren't", "wasn't", "weren't",
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "cannot",
  "couldn't", "shouldn't", "mightn't", "mustn't",
  "'s", "'re", "'ve", "'d", "'ll", "'m",
  "what", "whatever", "whoever", "where", "when", "why", "how",
  "very", "too", "quite", "more", "most", "such", "really", "extremely", "pretty", "fairly", "just", "only"
]);

// Wielowyrazowe frazy wiszące
export const DANGLING_PHRASES = [
  "such as", "as well as", "due to", "because of", "in order to",
  "so that", "as if", "as though", "going to", "want to", "have to",
  "has to", "had to", "used to", "out of", "instead of", "according to",
  "based on", "prior to", "next to", "up to"
];

// Typowe słowa rozpoczynające nowe zdanie lub myśl w naturalnej mowie angielskiej
export const SENTENCE_STARTERS = new Set([
  "so", "and", "but", "because", "or", "well", "now", "then", "also", "actually",
  "in fact", "plus", "anyway", "meanwhile", "however", "if", "when", "while",
  "although", "though", "since", "after", "before", "unless", "until", "as",
  "i", "you", "we", "they", "he", "she", "it", "there", "that", "this", "these",
  "those", "what", "why", "how", "where", "who", "which", "you know", "i mean",
  "right", "okay", "sure", "yeah", "yes", "no"
]);

/**
 * Sprawdza, czy końcówka tekstu stanowi bezwzględnie niedozwolony koniec zdania
 * (np. "the", "of", "because of", "in order to").
 */
export const hasStrictDanglingEnd = (text) => {
  if (!text) return false;
  const stripped = text.trim().replace(/[.,!?;:"'”’)\]]+$/, "").trim();
  if (!stripped) return false;
  const lower = stripped.toLowerCase();
  for (const phrase of DANGLING_PHRASES) {
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
 * Ignoruje cudzysłowy i nawiasy zamykające na końcu, sprawdza czy przed kropką nie stoi skrót
 * ani słowo z listy STRICT_DANGLING_END_WORDS.
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

  // Usuwamy ewentualne cudzysłowy, nawiasy zamykające na samym końcu
  const stripped = trimmed.replace(/["'”’)\]]+$/, "");
  if (!stripped) return false;

  const lastChar = stripped[stripped.length - 1];
  if (lastChar === "." || lastChar === "?" || lastChar === "!") {
    const words = stripped.split(/\s+/);
    if (words.length === 0) return false;
    const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z0-9.']/g, "");

    // Skróty z kropką (np. dr., mr., e.g.)
    if (ABBREVIATIONS.has(lastWord) || ABBREVIATIONS.has(lastWord.replace(/\.$/, ""))) {
      return false;
    }

    // Słowa wiszące, przed którymi omyłkowo postawiono kropkę (np. "seen the.")
    const cleanWord = lastWord.replace(/[.]+$/, "");
    if (STRICT_DANGLING_END_WORDS.has(cleanWord)) {
      return false;
    }

    // Wielowyrazowe frazy wiszące
    if (hasStrictDanglingEnd(stripped.slice(0, -1))) {
      return false;
    }

    return true;
  }
  return false;
};

/**
 * Prawidłowo formatuje wielkość liter przy doklejaniu fragmentu do nieskończonego zdania.
 * Np. "the" + "Models yet" -> "the models yet".
 * Respektuje zaimek "I", skróty/akronimy (AI, USA) oraz nazwiska po tytulaturze (Dr. Smith).
 */
export const formatContinuation = (segText, prevText = "") => {
  if (!segText) return "";
  const parts = segText.split(/(\s+)/);
  const firstWord = parts[0];
  if (!firstWord) return segText;

  // Jeśli poprzedni fragment kończył się tytulaturą (Dr., Mr., Prof.), nie obniżamy wielkości litery
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
 * Dzieli długą, niepunktowaną frazę (np. > 18-20 słów) na naturalne, pełne jednostki zdań/myśli
 * o optymalnej długości 10-18 słów. Zapewnia wielką literę na początku i kropkę na końcu.
 */
export const splitLongUnpunctuatedClause = (text) => {
  if (!text) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  
  if (words.length <= 20) {
    let s = words.join(" ");
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

    if (count >= 10 && remaining >= 4) {
      const nextWord = (words[i + 1] || "").toLowerCase().replace(/[^a-z']/g, "");
      const nextTwoWords = words[i + 2] 
        ? `${nextWord} ${(words[i + 2] || "").toLowerCase().replace(/[^a-z']/g, "")}` 
        : "";

      const isStarter = SENTENCE_STARTERS.has(nextWord) || SENTENCE_STARTERS.has(nextTwoWords);
      const currLast = (words[i] || "").toLowerCase().replace(/[^a-z']/g, "");
      const isCurrDangling = UNPUNCTUATED_DANGLING_WORDS.has(currLast);

      // Dzielimy, jeśli osiągnięto min. 10 słów i kolejne słowo to spójnik/zaimek,
      // pod warunkiem, że obecne słowo NIE JEST wiszącym spójnikiem/przedimkiem/przyimkiem!
      if (!isCurrDangling && ((count >= 10 && isStarter) || count >= 18)) {
        let sent = currentWords.join(" ").trim();
        sent = sent.charAt(0).toUpperCase() + sent.slice(1);
        if (!/[.?!]["'”’)]?$/.test(sent)) sent += ".";
        results.push(sent);
        currentWords = [];
      }
    }
  }

  if (currentWords.length > 0) {
    let sent = currentWords.join(" ").trim();
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
 * Dzieli pojedynczy blok tekstu zawierający wiele zdań na tablicę pojedynczych, pełnych zdań.
 * Respektuje skróty, cudzysłowy i automatycznie dzieli długie niepunktowane ciągi mowy.
 */
export const splitBlockIntoSentences = (text) => {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Szukamy sekwencji kończących zdanie (.?! wraz z opcjonalnymi cudzysłowami)
  // poprzedzających spację i kolejną wielką literę / cyfrę / cudzysłów
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

  // Weryfikujemy każdy fragment: jeśli fragment nie ma interpunkcji i przekracza 20 słów,
  // dzielimy go na czytelne jednostki zdań
  const finalSentences = [];
  for (const piece of rawPieces) {
    const words = piece.split(/\s+/).filter(Boolean);
    if (words.length > 20) {
      finalSentences.push(...splitLongUnpunctuatedClause(piece));
    } else {
      let s = piece.trim();
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
      finalSentences.push(s);
    }
  }

  return finalSentences;
};

/**
 * Główna funkcja normalizująca dowolną tablicę segmentów transkrypcji [{start, end, text}].
 * Gwarantuje:
 * 1. Każdy zwrócony element reprezentuje DOKŁADNIE JEDNO PEŁNE ZDANIE.
 * 2. Znacznik 'start' znajduje się WYŁĄCZNIE na początku logicznego zdania.
 * 3. Segmenty urwane w połowie zdania są łączone w spójną całość bez wiszących przedimków i przyimków.
 * 4. Bloki zawierające wiele zdań są rozdzielane z proporcjonalnymi znacznikami czasu.
 * 5. Dla mowy bez interpunkcji: rozkłada treść na naturalne karty zdań z proporcjonalnym czasem.
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

  // Krok 1: Inteligentne łączenie segmentów w pełne bloki zdań
  const mergedBlocks = [];
  let current = null;

  for (let i = 0; i < cleaned.length; i++) {
    const seg = cleaned[i];
    const text = seg.text.trim();

    if (!current) {
      current = {
        start: seg.start,
        end: seg.end,
        text: text,
        wordCount: text.split(/\s+/).length
      };
    } else {
      const prevWordCount = current.wordCount;
      const gap = seg.start - current.end;
      const nextFirstWord = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z']/g, "");
      const endsPunc = isSentenceEnd(current.text);
      const isStrictDangling = hasStrictDanglingEnd(current.text);
      const isUnpunctuatedDangling = hasUnpunctuatedDanglingEnd(current.text);

      let shouldSplit = false;
      if (endsPunc && !isStrictDangling) {
        // Jawne, gramatyczne zakończenie zdania interpunkcją (kropka, pytajnik, wykrzyknik)
        shouldSplit = true;
      } else if (!isUnpunctuatedDangling && gap >= 1.2 && prevWordCount >= 6) {
        // Naturalna, długa pauza w mowie (min. 1.2s) po kompletnej jednostce
        shouldSplit = true;
      } else if (!isUnpunctuatedDangling && prevWordCount >= 12 && SENTENCE_STARTERS.has(nextFirstWord)) {
        // Nowa fraza/myśl rozpoczynająca się od spójnika lub zaimka po min. 12 słowach
        shouldSplit = true;
      } else if (!isUnpunctuatedDangling && prevWordCount >= 18) {
        // Bezpieczny limit słów dla niepunktowanej mowy
        shouldSplit = true;
      } else if (!isUnpunctuatedDangling && (current.end - current.start) >= 9.0 && prevWordCount >= 8) {
        // Bezpieczny limit czasu trwania pojedynczej karty (9.0s)
        shouldSplit = true;
      }

      if (shouldSplit) {
        let sent = current.text.trim();
        sent = sent.charAt(0).toUpperCase() + sent.slice(1);
        if (!/[.?!]["'”’)]?$/.test(sent)) {
          sent += ".";
        }
        current.text = sent;
        mergedBlocks.push(current);
        current = {
          start: seg.start,
          end: seg.end,
          text: text,
          wordCount: text.split(/\s+/).length
        };
      } else {
        current.end = Math.max(current.end, seg.end);
        let cleanPrev = current.text.trim();
        if (isStrictDangling) {
          cleanPrev = cleanPrev.replace(/[.,;:]+$/, "");
        }
        const contText = (!endsPunc || isStrictDangling) ? formatContinuation(text, cleanPrev) : text;
        if (cleanPrev.endsWith("-") || contText.startsWith("'")) {
          current.text = `${cleanPrev}${contText}`;
        } else {
          current.text = `${cleanPrev} ${contText}`;
        }
        current.wordCount = current.text.split(/\s+/).length;
      }
    }
  }

  // Zamknięcie ostatniego bloku
  if (current) {
    let sent = current.text.trim();
    sent = sent.charAt(0).toUpperCase() + sent.slice(1);
    if (!/[.?!]["'”’)]?$/.test(sent)) {
      sent += ".";
    }
    current.text = sent;
    mergedBlocks.push(current);
  }

  // Krok 2: Rozbicie bloków na pojedyncze zdania z proporcjonalnymi znacznikami czasu
  const finalSentences = [];
  for (const block of mergedBlocks) {
    const sents = splitBlockIntoSentences(block.text);
    if (sents.length <= 1) {
      finalSentences.push({
        start: Math.round(block.start * 100) / 100,
        end: Math.round(block.end * 100) / 100,
        text: (sents[0] || block.text).replace(/\s+/g, " ").trim()
      });
    } else {
      const totalChars = sents.reduce((acc, s) => acc + s.length, 0);
      const duration = Math.max(0, block.end - block.start);
      let currStart = block.start;
      for (let j = 0; j < sents.length; j++) {
        const s = sents[j].replace(/\s+/g, " ").trim();
        const sFraction = totalChars > 0 ? s.length / totalChars : 1 / sents.length;
        const sEnd = j === sents.length - 1 ? block.end : currStart + sFraction * duration;
        finalSentences.push({
          start: Math.round(currStart * 100) / 100,
          end: Math.round(sEnd * 100) / 100,
          text: s
        });
        currStart = sEnd;
      }
    }
  }

  // Krok 3: Dodatkowy filtr bezpieczeństwa gwarantujący, że żaden segment nie przekracza dopuszczalnej długości
  const polishedSentences = [];
  for (const item of finalSentences) {
    const words = item.text.split(/\s+/).filter(Boolean);
    if (words.length > 22) {
      const parts = splitLongUnpunctuatedClause(item.text);
      if (parts.length > 1) {
        const totalChars = parts.reduce((acc, s) => acc + s.length, 0);
        const duration = Math.max(0, item.end - item.start);
        let cStart = item.start;
        for (let k = 0; k < parts.length; k++) {
          const p = parts[k].replace(/\s+/g, " ").trim();
          const frac = totalChars > 0 ? p.length / totalChars : 1 / parts.length;
          const cEnd = k === parts.length - 1 ? item.end : cStart + frac * duration;
          polishedSentences.push({
            start: Math.round(cStart * 100) / 100,
            end: Math.round(cEnd * 100) / 100,
            text: p
          });
          cStart = cEnd;
        }
        continue;
      }
    }
    polishedSentences.push(item);
  }

  // Krok 4: Finałowy pass zszywający (stitching) - bezwzględne wyeliminowanie wiszących fragmentów
  const stitched = [];
  for (let i = 0; i < polishedSentences.length; i++) {
    const curr = polishedSentences[i];
    if (i < polishedSentences.length - 1 && hasStrictDanglingEnd(curr.text)) {
      const next = polishedSentences[i + 1];
      let cleanCurr = curr.text.replace(/[.,;:]+$/, "");
      let nextText = formatContinuation(next.text, cleanCurr);
      polishedSentences[i + 1] = {
        start: curr.start,
        end: next.end,
        text: `${cleanCurr} ${nextText}`
      };
    } else {
      stitched.push(curr);
    }
  }

  return stitched;
};

export default ensureCompleteSentences;
