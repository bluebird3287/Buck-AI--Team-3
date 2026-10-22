import React from 'react';
import { Inbox, ShieldCheck } from 'lucide-react';

// The advisor's own screen (Screen 3, advisor side of the roles table): the queue of
// student requests routed to them. Requests aren't saved across users yet, so the queue
// is empty for now; real routing lands here once requests are stored (Session 4).
export const AdvisorView: React.FC<{ email: string }> = ({ email }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-[1100px] mx-auto p-4 sm:p-8">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="h-1.5 bg-[#ba0c2f]" />
          <div className="p-5 sm:p-6 border-b border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-[#ba0c2f] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Advisor queue</h1>
              <p className="text-xs text-gray-600">Signed in as {email} · Advisor</p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Student requests routed to you</h2>
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No requests yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                When a student escalates a high-stakes decision or asks to clear a hold, it will appear here. Saved
                routing arrives when we store requests per user (Session 4).
              </p>
            </div>

            <p className="text-[11px] text-gray-400 mt-4">
              You only see requests from your own advisees, per the roles table in CLAUDE.md. Student pages (dashboard,
              roadmap, seat alerts) are not shown to advisors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
