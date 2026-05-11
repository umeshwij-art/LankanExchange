import React from "react";
import { PortfolioNerveCenter } from "../components/PortfolioNerveCenter";
import { Helmet } from "react-helmet-async";

export default function Portfolio() {
  return (
    <div className="min-h-screen bg-[#09090b]">
      <Helmet>
        <title>Portfolio | Colombo Exchange</title>
      </Helmet>
      
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-xl min-h-[calc(100vh-200px)] overflow-hidden">
          <PortfolioNerveCenter showHeader={true} />
        </div>
      </div>
    </div>
  );
}
