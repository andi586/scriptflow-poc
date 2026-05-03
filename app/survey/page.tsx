"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const questions = [
  {
    id: "question_1",
    question: "What kind of story would you like to star in?",
    options: [
      "🦸 Epic Adventure",
      "💕 Romance",
      "😂 Comedy",
      "🔮 Fantasy",
      "🕵️ Mystery/Thriller",
      "🚀 Sci-Fi",
    ],
  },
  {
    id: "question_2",
    question: "What's your dream role?",
    options: [
      "🦸 The Hero",
      "🧙 The Wise Mentor",
      "😈 The Villain",
      "🤡 The Comic Relief",
      "💔 The Tragic Figure",
      "🎭 The Mysterious Stranger",
    ],
  },
  {
    id: "question_3",
    question: "Pick your movie vibe",
    options: [
      "🌅 Bright & Uplifting",
      "🌙 Dark & Moody",
      "✨ Magical & Whimsical",
      "⚡ Fast-paced & Intense",
      "🎨 Artistic & Thoughtful",
      "🎪 Wild & Unpredictable",
    ],
  },
  {
    id: "question_4",
    question: "How do you want your character to look?",
    options: [
      "👔 Sharp & Professional",
      "🧥 Casual & Relatable",
      "👗 Elegant & Glamorous",
      "🦹 Bold & Edgy",
      "🧙 Mystical & Otherworldly",
      "🤠 Rugged & Adventurous",
    ],
  },
  {
    id: "question_5",
    question: "What's your character's superpower?",
    options: [
      "🧠 Genius-level Intelligence",
      "💪 Superhuman Strength",
      "🗣️ Persuasion & Charm",
      "🔮 Magical Abilities",
      "⚡ Lightning Speed",
      "❤️ Empathy & Healing",
    ],
  },
  {
    id: "question_6",
    question: "One word to describe your movie",
    options: [
      "🔥 Epic",
      "💖 Heartwarming",
      "😱 Thrilling",
      "😂 Hilarious",
      "😢 Emotional",
      "🤯 Mind-bending",
    ],
  },
];

export default function SurveyPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [generationLink, setGenerationLink] = useState("");

  const handleAnswer = (answer: string) => {
    const questionId = questions[currentQuestion].id;
    setAnswers({ ...answers, [questionId]: answer });

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowEmailInput(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          ...answers,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGenerationLink(data.generationLink);
        setShowThankYou(true);
      } else {
        alert(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting survey:", error);
      alert("Failed to submit survey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (showEmailInput) {
      setShowEmailInput(false);
    } else if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showThankYou) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-6xl mb-6"
          >
            🎉
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            You're All Set!
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            Check your email for your FREE movie generation link! 🎬
          </p>
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 mb-8">
            <p className="text-sm text-gray-600 mb-2">Your unique link:</p>
            <code className="text-sm bg-white px-4 py-2 rounded-lg block break-all">
              {generationLink}
            </code>
          </div>
          <p className="text-gray-600 mb-8">
            We can't wait to see you become the star of your own AI movie! 🌟
          </p>
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-full hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            Go to Homepage
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            🎬 Be the Main Character
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-white/90">
            in Your Own AI Movie
          </h2>
        </motion.div>

        {/* Progress Bar */}
        {!showEmailInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <div className="bg-white/30 rounded-full h-3 overflow-hidden backdrop-blur-sm">
              <motion.div
                className="bg-white h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-white text-center mt-2 text-sm">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </motion.div>
        )}

        {/* Question Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 md:p-12"
        >
          <AnimatePresence mode="wait">
            {!showEmailInput ? (
              <motion.div
                key={currentQuestion}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
                  {questions[currentQuestion].question}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questions[currentQuestion].options.map((option, index) => (
                    <motion.button
                      key={option}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleAnswer(option)}
                      className={`p-6 rounded-2xl text-left font-semibold text-lg transition-all duration-300 ${
                        answers[questions[currentQuestion].id] === option
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200 hover:scale-105"
                      }`}
                    >
                      {option}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 text-center">
                  Almost there! 🎉
                </h3>
                <p className="text-gray-600 text-center mb-8">
                  Enter your email to get your FREE movie generation link
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 focus:border-purple-600 focus:outline-none text-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl"
                  >
                    {isSubmitting ? "Submitting..." : "🎬 Get My FREE Movie"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back Button */}
          {(currentQuestion > 0 || showEmailInput) && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleBack}
              className="mt-6 text-gray-600 hover:text-gray-800 font-semibold flex items-center gap-2 mx-auto"
            >
              ← Back
            </motion.button>
          )}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white text-center mt-8 text-sm"
        >
          Your responses help us create the perfect movie experience for you ✨
        </motion.p>
      </div>
    </div>
  );
}
