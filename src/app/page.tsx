import Link from "next/link";
import { FileText, MessageSquare, User } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] text-center">
      <div className="max-w-3xl p-8 bg-card rounded-lg border border-border">
        <h1 className="text-5xl font-bold text-foreground mb-4">
          PrimeLegal AI Advisor
        </h1>
        <p className="text-xl text-muted-foreground mb-10">
          Your personal AI assistant for instant legal document analysis and expert advice.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <FeatureCard
            icon={FileText}
            title="Upload Documents"
            description="Securely upload your legal PDFs, DOCX, and TXT files for processing."
            link="/documents"
            linkText="Go to Documents"
          />
          <FeatureCard
            icon={MessageSquare}
            title="Chat Advisor"
            description="Ask complex questions about your documents and get clear, concise answers."
            link="/chat"
            linkText="Start Chatting"
          />
          <FeatureCard
            icon={User}
            title="Secure Account"
            description="Your data is protected with secure authentication and private storage."
            link="/login"
            linkText="Sign In / Register"
          />
        </div>

        <p className="text-lg text-muted-foreground">
          Ready to simplify your legal research?
        </p>
        <Link
          href="/register"
          className="mt-4 inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-200"
        >
          Get Started Now
        </Link>
      </div>
    </div>
  );
}

const FeatureCard = ({ icon: Icon, title, description, link, linkText }: any) => (
  <div className="p-6 bg-secondary rounded-lg border border-border hover:border-primary/50 transition-all duration-200">
    <Icon className="w-10 h-10 text-primary mb-4 mx-auto" />
    <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    <Link
      href={link}
      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
    >
      {linkText} &rarr;
    </Link>
  </div>
);

