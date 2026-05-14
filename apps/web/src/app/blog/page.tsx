import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h3 className="text-4xl font-bold text-gray-900 mt-12 mb-4">Coming Soon</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          We're working on some interesting posts about local-first apps, P2P networking, and why
          you might not need a backend.
        </p>
        <Link
          href="/"
          className="text-gray-500 hover:text-black transition-colors flex items-center gap-2 text-sm font-medium justify-center"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
