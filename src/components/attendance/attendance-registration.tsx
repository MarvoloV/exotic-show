"use client";

import { useEffect, useRef, useState } from "react";
import { AttendanceStatus } from "@/components/attendance/attendance-status";
import { submitAttendance, type AttendanceState } from "@/lib/attendance/result";

export function AttendanceRegistration({ token }: { token: string }) {
  const [result, setResult] = useState<AttendanceState>({ outcome: "loading" });
  const pending = useRef<{ token: string; promise: Promise<AttendanceState> } | null>(null);
  const mounted = useRef(false);
  const retrying = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Reuse the in-flight request during Strict Mode's setup/cleanup replay.
    if (!pending.current || pending.current.token !== token) {
      pending.current = { token, promise: submitAttendance(token) };
    }
    void pending.current.promise.then((response) => { if (active) setResult(response); });
    return () => { active = false; mounted.current = false; };
  }, [token]);

  async function retry() {
    if (retrying.current) return;
    retrying.current = true;
    setResult({ outcome: "loading" });
    const response = await submitAttendance(token);
    if (mounted.current) setResult(response);
    retrying.current = false;
  }

  return <AttendanceStatus result={result} onRetry={retry} />;
}
