import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { AdvisingRequest } from '../../lib/advising';
import { RequestDetail } from './RequestDetail';

// The full request in a pop-up over the current screen (used from the Availability
// calendar), so the advisor can review and decide without losing their place. Built on the
// native <dialog> element: it traps focus, closes on Escape, and returns focus on close.

interface RequestDialogProps {
  request: AdvisingRequest | null;
  onClose: () => void;
  onDecided: (message: string) => void;
}

export const RequestDialog: React.FC<RequestDialogProps> = ({ request, onClose, onDecided }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      aria-label={request ? `Request from ${request.student.name}` : 'Student request'}
      className="m-auto w-[min(960px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-xl bg-[#f3f4f6] p-0 shadow-2xl backdrop:bg-black/50"
    >
      {request && (
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
            <p className="text-sm font-semibold text-gray-900">Full request</p>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
            >
              <X className="w-4 h-4" aria-hidden /> Close
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            <RequestDetail request={request} onDecided={onDecided} />
          </div>
        </div>
      )}
    </dialog>
  );
};
