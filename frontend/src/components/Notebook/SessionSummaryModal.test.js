import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import SessionSummaryModal from "./SessionSummaryModal";

describe("SessionSummaryModal", () => {
  const mockSummary = {
    listening_analysis: {
      completed_entire_text: true,
      sentences_listened: 12,
      total_sentences: 12,
      feedback_pl: "Ukończyłeś całe nagranie!"
    },
    engagement_analysis: {
      level: "Wysokie",
      dictionary_checks_count: 5,
      saved_words_count: 2,
      feedback_pl: "Świetna aktywność w słowniku."
    },
    pronunciation_drills: [
      {
        word: "Curse of Knowledge",
        translation: "Przekleństwo wiedzy",
        example: "To communicate well, avoid the curse of knowledge.",
        times_listened: 3,
        was_mispronounced: false
      },
      {
        word: "Science",
        translation: "Nauka",
        example: "Science is progress.",
        times_listened: 1,
        was_mispronounced: true
      }
    ],
    vocabulary_analysis: {
      added_words: ["fluency", "biography"],
      forgotten_words: [
        {
          word: "curiosity",
          translation: "ciekawość",
          example: "Curiosity is a great tool.",
          reason_pl: "Słowo było sprawdzane wielokrotnie."
        }
      ]
    }
  };
  const mockUser = { email: "student@example.com" };
  const mockOnClose = jest.fn();

  test("renders all analysis sections correctly", () => {
    const mockOnSendEmail = jest.fn();
    const mockOnAddWord = jest.fn();

    render(
      <SessionSummaryModal
        summary={mockSummary}
        user={mockUser}
        onClose={mockOnClose}
        onSendEmail={mockOnSendEmail}
        onAddWord={mockOnAddWord}
      />
    );

    // Verify listening analysis
    expect(screen.getByText("Odsłuch i Kompletność Tekstu")).toBeInTheDocument();
    expect(screen.getByText("Ukończono w całości")).toBeInTheDocument();
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
    expect(screen.getByText("Ukończyłeś całe nagranie!")).toBeInTheDocument();

    // Verify engagement analysis
    expect(screen.getByText("Ocena Zaangażowania")).toBeInTheDocument();
    expect(screen.getByText("Poziom: Wysokie")).toBeInTheDocument();
    expect(screen.getByText("Świetna aktywność w słowniku.")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Verify pronunciation drills
    expect(screen.getByText("Curse of Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Przekleństwo wiedzy")).toBeInTheDocument();
    expect(screen.getByText(/To communicate well, avoid/i)).toBeInTheDocument();
    expect(screen.getByText("Odsłuch: 3x")).toBeInTheDocument();

    // Verify mispronounced drills
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(screen.getByText("Nauka")).toBeInTheDocument();
    expect(screen.getByText("Słaba wymowa ⚠️")).toBeInTheDocument();

    // Verify vocabulary
    expect(screen.getByText("✓ fluency")).toBeInTheDocument();
    expect(screen.getByText("✓ biography")).toBeInTheDocument();
    expect(screen.getByText("curiosity")).toBeInTheDocument();
    expect(screen.getByText("ciekawość")).toBeInTheDocument();
    expect(screen.getByText(/Dlaczego warto zapisać:/i)).toBeInTheDocument();
    expect(screen.getByText(/Słowo było sprawdzane wielokrotnie/i)).toBeInTheDocument();
  });

  test("submitting email invokes onSendEmail and displays success state", async () => {
    const mockOnSendEmail = jest.fn().mockResolvedValue(true);
    const mockOnAddWord = jest.fn();

    render(
      <SessionSummaryModal
        summary={mockSummary}
        user={mockUser}
        onClose={mockOnClose}
        onSendEmail={mockOnSendEmail}
        onAddWord={mockOnAddWord}
      />
    );

    const emailInput = screen.getByPlaceholderText(/Wpisz adres e-mail/i);
    expect(emailInput.value).toBe("student@example.com");

    const sendButton = screen.getByRole("button", { name: /^Wyślij raport$/i });
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    expect(mockOnSendEmail).toHaveBeenCalledWith("student@example.com");
    expect(await screen.findByText(/Raport został pomyślnie wysłany/i)).toBeInTheDocument();
  });

  test("clicking quick add button invokes onAddWord callback and changes label", async () => {
    const mockOnSendEmail = jest.fn();
    const mockOnAddWord = jest.fn().mockResolvedValue(true);

    render(
      <SessionSummaryModal
        summary={mockSummary}
        user={mockUser}
        onClose={mockOnClose}
        onSendEmail={mockOnSendEmail}
        onAddWord={mockOnAddWord}
      />
    );

    const quickAddButton = screen.getByText("Dodaj do notesu");
    expect(quickAddButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(quickAddButton);
    });

    expect(mockOnAddWord).toHaveBeenCalledWith("curiosity", "ciekawość");
    expect(screen.getByText("✓ Zapisano")).toBeInTheDocument();
  });
});
