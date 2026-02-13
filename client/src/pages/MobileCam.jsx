import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MobileCam() {
    const { sessionId } = useParams();
    const [status, setStatus] = useState('connecting'); // connecting, connected, error
    const [socket, setSocket] = useState(null);
    const videoRef = useRef(null);
    const [streamError, setStreamError] = useState('');

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            return;
        }

        const newSocket = io(`${URL}/exam`, {
            transports: ['websocket'],
            auth: {
                token: new URLSearchParams(window.location.search).get('token')
            }
        });

        newSocket.on('connect', () => {
            setStatus('connected');
            newSocket.emit('mobile:join', sessionId);
        });

        newSocket.on('connect_error', (err) => {
            console.error(err);
            setStatus('error');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [sessionId]);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera Error:", err);
                setStreamError('Enable camera access to continue.');
            }
        };

        startCamera();

        return () => {
            // Cleanup stream
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div style={{
            height: '100vh', width: '100vw', background: '#000', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden'
        }}>
            {/* Camera View */}
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
                    opacity: status === 'connected' ? 1 : 0.3, transition: 'opacity 0.5s'
                }}
            />

            {/* Overlay Status */}
            <div style={{
                position: 'relative', zIndex: 10,
                background: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 16,
                backdropFilter: 'blur(10px)', textAlign: 'center',
                maxWidth: '90%'
            }}>
                {status === 'connecting' && (
                    <>
                        <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', margin: '0 auto' }} />
                        <p style={{ marginTop: 16 }}>Connecting to Exam...</p>
                    </>
                )}

                {status === 'connected' && !streamError && (
                    <>
                        <div style={{ fontSize: 48 }}>✅</div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0' }}>Device Connected</h1>
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                            Place phone behind you. Do not close tab.
                        </p>
                    </>
                )}

                {streamError && (
                    <>
                        <div style={{ fontSize: 48 }}>📸</div>
                        <p style={{ color: '#ff6b6b', fontWeight: 600 }}>{streamError}</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div style={{ fontSize: 48 }}>⚠️</div>
                        <p style={{ marginTop: 16 }}>Connection Failed</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                            Invalid session or network error.
                        </p>
                    </>
                )}
            </div>

            <div style={{
                position: 'absolute', bottom: 20, right: 20, zIndex: 10,
                background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4,
                fontSize: 10, fontFamily: 'monospace'
            }}>
                ID: {sessionId}
            </div>
        </div>
    );
}
