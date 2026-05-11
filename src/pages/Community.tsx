import React from "react";
import { FeedbackTab } from "../components/FeedbackTab";
import { Helmet } from "react-helmet-async";
import { Sparkles } from "lucide-react";

export default function Community() {
  return (
    <div className="min-h-screen bg-[#09090b]">
      <Helmet>
        <title>Community Lab | Colombo Exchange</title>
      </Helmet>
      
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif">Community Lab</h1>
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Shape the future of Colombo Exchange</p>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl min-h-[calc(100vh-250px)]">
            <FeedbackTab />
          </div>
        </div>
      </div>
    </div>
  );
}
