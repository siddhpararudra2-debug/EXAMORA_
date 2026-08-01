import { useState, useEffect, useCallback } from 'react';

export interface DevicePermissionsState {
  isLoading: boolean;
  hasPermission: boolean;
  errorMessage: string | null;
  stream: MediaStream | null;
  cameraAllowed: boolean;
  micAllowed: boolean;
  requestPermissions: () => Promise<void>;
}

export const useDevicePermissions = (): DevicePermissionsState => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraAllowed, setCameraAllowed] = useState<boolean>(false);
  const [micAllowed, setMicAllowed] = useState<boolean>(false);

  const stopExistingStream = (activeStream: MediaStream | null) => {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  };

  const requestPermissions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // Clean up previous stream if any
    setStream((prevStream) => {
      stopExistingStream(prevStream);
      return null;
    });

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsLoading(false);
      setHasPermission(false);
      setErrorMessage('Media devices API is not supported in this browser environment.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      const videoTracks = mediaStream.getVideoTracks();
      const audioTracks = mediaStream.getAudioTracks();

      const hasVideo = videoTracks.length > 0 && videoTracks[0].readyState === 'live';
      const hasAudio = audioTracks.length > 0 && audioTracks[0].readyState === 'live';

      setStream(mediaStream);
      setCameraAllowed(hasVideo);
      setMicAllowed(hasAudio);

      if (hasVideo && hasAudio) {
        setHasPermission(true);
        setErrorMessage(null);
      } else {
        setHasPermission(false);
        setErrorMessage('Required hardware (Webcam/Microphone) was not fully activated.');
      }
    } catch (error: any) {
      setHasPermission(false);
      setCameraAllowed(false);
      setMicAllowed(false);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Permission Denied: Webcam and Microphone access are required for proctored exams. Please enable camera and microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setErrorMessage('Hardware Not Found: No webcam or microphone detected. Please connect your hardware and try again.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setErrorMessage('Hardware In Use: Your webcam or microphone is currently being used by another application.');
      } else if (error.name === 'OverconstrainedError') {
        setErrorMessage('Constraint Error: Connected camera/microphone does not support the requested video settings.');
      } else {
        setErrorMessage(error.message || 'An unknown error occurred while requesting device permissions.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    requestPermissions();

    return () => {
      setStream((currentStream) => {
        stopExistingStream(currentStream);
        return null;
      });
    };
  }, [requestPermissions]);

  return {
    isLoading,
    hasPermission,
    errorMessage,
    stream,
    cameraAllowed,
    micAllowed,
    requestPermissions,
  };
};

export default useDevicePermissions;
