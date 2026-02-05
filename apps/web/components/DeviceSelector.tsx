"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { DeviceType } from "../types";
import { detectDeviceTypeFromLabel } from "../lib/deviceTypeDetection";

const STORAGE_KEY = "miccheck-preferred-device-id";

interface DeviceSelectorProps {
  onDeviceChange: (deviceId: string | null, meta?: { label?: string; detectedType: DeviceType }) => void;
}

export default function DeviceSelector({ onDeviceChange }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not supported in this browser.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      const inputDevices = availableDevices.filter(
        (device) => device.kind === "audioinput"
      );
      setDevices(inputDevices);

      const storedId = window.localStorage.getItem(STORAGE_KEY);
      const defaultId =
        (storedId && inputDevices.some((device) => device.deviceId === storedId)
          ? storedId
          : inputDevices[0]?.deviceId) ?? "";

      setSelectedId(defaultId);
      const selectedDevice = inputDevices.find((device) => device.deviceId === defaultId);
      onDeviceChange(defaultId || null, {
        label: selectedDevice?.label,
        detectedType: detectDeviceTypeFromLabel(selectedDevice?.label)
      });

      if (defaultId) {
        window.localStorage.setItem(STORAGE_KEY, defaultId);
      }
    } catch (permissionError) {
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : "Unable to load available microphones."
      );
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceChange]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      void loadDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [loadDevices]);

  const options = useMemo(() => {
    return devices.map((device) => ({
      id: device.deviceId,
      label: device.label || "Unknown microphone"
    }));
  }, [devices]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setSelectedId(nextId);
    window.localStorage.setItem(STORAGE_KEY, nextId);
    const selectedDevice = devices.find((device) => device.deviceId === nextId);
    onDeviceChange(nextId || null, {
      label: selectedDevice?.label,
      detectedType: detectDeviceTypeFromLabel(selectedDevice?.label)
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200" htmlFor="miccheck-device-selector">
        Microphone
      </label>
      <select
        id="miccheck-device-selector"
        className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 shadow-sm focus:border-brand-500 focus:outline-none"
        disabled={isLoading || options.length === 0}
        onChange={handleChange}
        value={selectedId}
      >
        {options.length === 0 ? (
          <option value="">No microphones found</option>
        ) : (
          options.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))
        )}
      </select>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
