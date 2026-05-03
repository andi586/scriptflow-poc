"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";

const questions = [
  {
    id: "q1_create",
    question: "What would you like to create next?",
    options: [
      "🎬 Another movie with different story",
      "🎭 Same story, different character",
      "📸 Photo-to-video content",
      "🎵 Music video",
      "📺 Series/Multiple episodes",
      "🎨 Custom creative project",
    ],
  },
  {
    id: "q2_preference",
    question: "What did you like most about your movie?",
    options: [
      "🎭 The character/acting",
      "📝 The story/script",
      "🎨 Visual quality",
      "🎵 Voice/audio",
      "⚡ Speed of creation",
      "💰 The price",
    ],
  },
  {
    id: "q3_price",
    question: "Was the price fair for what you got?",
    options: [
      "💎 Great value!",
      "👍 Fair price",
      "🤔 A bit expensive",
      "💸 Too expensive",
      "🎁 Would prefer subscription",
      "💳 Would pay more for premium",
    ],
  },
  {
    id: "q4_voice",
    question: "How was the voice quality?",
    options: [
      "🌟 Perfect!",
      "👍 Good enough",
      "🤔 Could be better",
      "😕 Not great",
      "🎤 Want to use my own voice",
      "🔇 Prefer no voice",
    ],
  },
  {
    id: "q5_share",
    question: "Would you share this with friends?",
    options: [
      "🔥 Already shared!",
      "✅ Yes, definitely",
      "🤔 Maybe",
      "😅 Probably not",
      "🙈 Too personal",
      "💡 After some edits",
    ],
  },
];

export default function SurveyPage() {
  const searchParams = useSearchParams();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [movieId, setMovieId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams?.get("movieId") || null;
    setMovieId(id);
  }, [searchParams]);

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

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          movieId,
          email: email || undefined,
          ...answers,
        }),
      });

      const data = await response.json();

      if (response.ok) {
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
            Thank You!
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            You've earned 1 FREE movie credit! 🎬
          </p>
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6 mb-8">
            <p className="text-2xl font-bold text-purple-600 mb-2">+1 Credit</p>
            <p className="text-sm text-gray-600">
              Your feedback helps us improve ScriptFlow for everyone!
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <a
              href="/create"
              className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-full hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              🎬 Create Your Free Movie Now
            </a>
            <a
              href={movieId ? `/movie/${movieId}` : "/"}
              className="text-gray-600 hover:text-gray-800 font-semibold"
            >
              ← Back to your movie
            </a>
          </div>
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
            🎬 Enjoying your movie?
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-white/90">
            Share your feedback and get 1 FREE movie!
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
                  Almost done! 🎉
                </h3>
                <p className="text-gray-600 text-center mb-8">
                  Email is optional - submit to claim your FREE credit!
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com (optional)"
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 focus:border-purple-600 focus:outline-none text-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl"
                  >
                    {isSubmitting ? "Submitting..." : "🎁 Claim My FREE Credit"}
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
          Your feedback helps us make ScriptFlow better for everyone ✨
        </motion.p>
      </div>
    </div>
  );
}
