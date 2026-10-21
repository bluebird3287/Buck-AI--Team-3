import React, { useState } from 'react';
import { Bookmark, ChevronDown, Share2, Check, Download } from 'lucide-react';
import { OhioStateHorizontalLogo } from './OhioStateHorizontalLogo';

interface HeaderProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  onOpenSurveyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onSelectStep,
  onOpenSurveyModal
}) => {
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const publicUrl = window.location.href.split('?')[0];
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
      {/* 1. Official Top Institutional Header Bar from Screenshot 1 */}
      <div className="bg-white border-b border-gray-200 py-3.5 px-6 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs sm:text-sm">
          {/* Official Ohio State Primary Logo & Wordmark matching user screenshot */}
          <a
            href="https://www.osu.edu"
            target="_blank"
            rel="noreferrer"
            className="flex items-center hover:opacity-90 transition-opacity py-0.5"
            title="The Ohio State University"
          >
            <OhioStateHorizontalLogo className="h-6 sm:h-7 md:h-8 w-auto" />
          </a>

          {/* Institutional Navigation Links */}
          <div className="flex items-center space-x-6 text-gray-700 text-xs sm:text-sm font-normal">
            <a href="#map" className="hover:text-black hover:underline hidden md:inline-block">Map</a>
            <a href="#webmail" className="hover:text-black hover:underline hidden sm:inline-block">Webmail</a>
            <a href="#search" className="hover:text-black hover:underline">Search Ohio State</a>
          </div>
        </div>
      </div>

      {/* 2. Buckeye Link Portal Subheader Bar from Screenshot 1 */}
      <div className="bg-white py-3.5 px-6 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          {/* Buckeye Link Portal Name */}
          <button
            onClick={() => onSelectStep(1)}
            className="text-[22px] font-bold text-gray-900 tracking-tight hover:opacity-80 transition-opacity"
          >
            Buckeye Link
          </button>

          {/* Bookmarks, Share, Sign Out */}
          <div className="flex items-center space-x-5 text-sm text-gray-900">
            <div className="relative">
              <button
                onClick={() => setBookmarksOpen(!bookmarksOpen)}
                className="flex items-center space-x-1.5 font-normal hover:text-black transition-colors"
              >
                <Bookmark className="w-4 h-4 fill-black text-black" />
                <span>Bookmarks</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-700" />
              </button>

              {bookmarksOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 shadow-xl rounded-md py-1.5 z-50 text-xs">
                  <a
                    href="#class-search"
                    onClick={() => setBookmarksOpen(false)}
                    className="w-full block px-4 py-2 hover:bg-gray-100 text-gray-800"
                  >
                    Class Search (SIS)
                  </a>
                  <a
                    href="#schedule-planner"
                    onClick={() => setBookmarksOpen(false)}
                    className="w-full block px-4 py-2 hover:bg-gray-100 text-gray-800"
                  >
                    Schedule Planner
                  </a>
                  <a
                    href="#degree-audit"
                    onClick={() => setBookmarksOpen(false)}
                    className="w-full block px-4 py-2 hover:bg-gray-100 text-gray-800"
                  >
                    Buckeye Degree Planner
                  </a>
                  <a
                    href="#statement"
                    onClick={() => setBookmarksOpen(false)}
                    className="w-full block px-4 py-2 hover:bg-gray-100 text-gray-800"
                  >
                    Statement of Account
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={handleCopyLink}
              className="hidden lg:flex items-center space-x-1 text-xs text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded transition-colors"
              title="Copy Public Link"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3 h-3 text-gray-500" />
                  <span>Share</span>
                </>
              )}
            </button>

            <a
              href="/api/download-zip"
              download="buckeyelink-advising-ai.zip"
              className="flex items-center space-x-1.5 text-xs text-white bg-[#ba0c2f] hover:bg-[#9d0a27] px-2.5 py-1 rounded font-semibold shadow-xs transition-colors"
              title="Download Complete Project ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </a>

            <button className="font-normal hover:text-black transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
