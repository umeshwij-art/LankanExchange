import React, { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  Bug, 
  Sparkles, 
  BarChart3, 
  Clock, 
  User,
  Bot
} from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp 
} from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "Bug 🐞", label: "Bug 🐞", icon: Bug },
  { id: "Feature Request ✨", label: "Feature Request ✨", icon: Sparkles },
  { id: "Market Data 📊", label: "Market Data 📊", icon: BarChart3 },
];

interface FeedbackItem {
  id: string;
  text: string;
  uid: string;
  alias: string;
  category: string;
  upvotes: string[];
  aiReply?: string;
  createdAt: any;
}

export function FeedbackTab() {
  const { user, profile } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState(CATEGORIES[1].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeedbackItem[];
      setFeedback(items);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to feedback:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const generateAiReply = async (feedbackText: string, userAlias: string) => {
    if (!process.env.GEMINI_API_KEY) return null;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are the AI dev assistant for "Colombo Exchange", a stock market training platform and simulator. 
        A user named "${userAlias}" just submitted this feedback: "${feedbackText}". 
        Provide a brief, supportive, and professional response (max 2 sentences). 
        Always include: "Great idea, ${userAlias}! We've logged this for the Colombo Exchange dev team." or something very similar.`,
      });
      return response.text;
    } catch (err) {
      console.error("Gemini Error:", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const alias = profile?.displayName || user.displayName || user.email?.split("@")[0] || "Anonymous";

    try {
      const aiReply = await generateAiReply(text, alias);

      await addDoc(collection(db, "feedback"), {
        text,
        uid: user.uid,
        alias,
        category,
        upvotes: [],
        aiReply: aiReply || undefined,
        createdAt: serverTimestamp(),
      });

      setText("");
      toast.success("Feedback submitted! Our AI has responded.");
      
      // EMAIL NOTIFICATION LOGIC SNIPPET (Requirement 3)
      /*
      // Cloud Function logic snippet:
      // exports.onFeedbackCreated = functions.firestore.document('feedback/{id}').onCreate(async (snap, context) => {
      //   const data = snap.data();
      //   const mailOptions = {
      //     from: '"Colombo Exchange System" <no-reply@colomboexchange.lk>',
      //     to: 'admin@colomboexchange.lk',
      //     subject: `New Feedback Submitted: ${data.category}`,
      //     text: `User ${data.alias} submitted new feedback:\n\n"${data.text}"\n\nAI Reply sent: ${data.aiReply || 'None'}`
      //   };
      //   return transporter.sendMail(mailOptions);
      // });
      */
    } catch (err) {
      toast.error("Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (item: FeedbackItem) => {
    if (!user) {
      toast.error("Please sign in to upvote.");
      return;
    }

    const hasUpvoted = item.upvotes?.includes(user.uid);
    const feedbackRef = doc(db, "feedback", item.id);

    try {
      await updateDoc(feedbackRef, {
        upvotes: hasUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (err) {
      toast.error("Failed to update upvote.");
    }
  };

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* Input Side */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Community Lab
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please share any features or feedbacks that you would like to see on our website.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-muted/30 p-6 rounded-xl border border-border/50">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all border",
                      category === cat.id 
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <Icon className="h-3 w-3" /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Thoughts</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Suggest a new indicator, report a bug, or request data..."
              className="w-full bg-background border border-border rounded-lg p-4 text-sm min-h-[120px] focus:outline-none focus:border-primary transition-all resize-none placeholder:text-muted-foreground/30"
            />
          </div>

          <Button 
            disabled={!text.trim() || isSubmitting || !user}
            className="w-full py-6 font-bold uppercase tracking-widest text-xs"
          >
            {isSubmitting ? "Processing..." : user ? "Submit Feedback" : "Sign In to Submit"}
            <Send className="ml-2 h-4 w-4" />
          </Button>
          {!user && <p className="text-[10px] text-center text-rose-500 font-bold uppercase">Authentication Required</p>}
        </form>
      </div>

      {/* Feed Side */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Public Roadmap Suggestions</h2>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground">{feedback.length} SUBMISSIONS</Badge>
        </div>

        <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-4 custom-scrollbar">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="p-6 bg-muted/20 border-border/50 animate-pulse h-32" />
            ))
          ) : feedback.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-xl">
              <MessageSquare className="h-10 w-10 text-muted-foreground/10 mx-auto mb-4" />
              <p className="text-xs text-muted-foreground font-mono">No feedback yet. Be the first!</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {feedback.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="p-6 bg-muted/20 border-border/50 hover:border-primary/30 transition-all group relative overflow-hidden">
                    {/* Category Accent */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase px-2">
                          {item.category}
                        </Badge>
                        <span className="text-[10px] font-bold text-white flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" /> {item.alias}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {item.createdAt?.toDate?.() ? new Date(item.createdAt.toDate()).toLocaleDateString() : "Just now"}
                      </span>
                    </div>

                    <p className="text-sm text-foreground mb-6 leading-relaxed">
                      {item.text}
                    </p>

                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => handleUpvote(item)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                          item.upvotes?.includes(user?.uid || "")
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        <ThumbsUp className={cn("h-3 w-3", item.upvotes?.includes(user?.uid || "") && "fill-current")} />
                        {item.upvotes?.length || 0}
                      </button>

                      {item.aiReply && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary animate-in fade-in slide-in-from-right-2">
                          <Bot className="h-3.5 w-3.5" /> AI ACKNOWLEDGED
                        </div>
                      )}
                    </div>

                    {item.aiReply && (
                      <div className="mt-4 p-4 bg-primary/5 rounded border border-primary/10 relative">
                        <div className="absolute top-2 left-2 text-primary/30">
                          <Bot className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] text-primary/80 italic leading-relaxed pl-6">
                          "{item.aiReply}"
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
