'use client';

import React, { useState, useRef } from 'react';
import AudioRecorder, { AudioReadyData } from './AudioRecorder';
import { SourceType } from '../types';

export interface SelectedSourceData {
  sourceType: SourceType;
  file: File;
  name: string;
  sizeBytes: number;
  mimeType: string;
  durationSec?: number;
  previewUrl?: string;
}

interface SourcePickerProps {
  selectedSource: SelectedSourceData | null;
  onSourceSelected: (source: SelectedSourceData | null) => void;
}

export default function SourcePicker({ selectedSource, onSourceSelected }: SourcePickerProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'upload_audio' | 'upload_doc'>('record');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const handleTabSelect = (tab: 'record' | 'upload_audio' | 'upload_doc') => {
    setActiveTab(tab);
    setUploadedFile(null);
    onSourceSelected(null);
  };

  const handleAudioRecorded = (audioData: AudioReadyData) => {
    onSourceSelected({
      sourceType: 'audio',
      file: audioData.file,
      name: audioData.file.name,
      sizeBytes: audioData.sizeBytes,
      mimeType: audioData.mimeType,
      durationSec: audioData.durationSec,
      previewUrl: audioData.url
    });
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    onSourceSelected({
      sourceType: 'audio',
      file,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'audio/mpeg'
    });
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    onSourceSelected({
      sourceType: 'document',
      file,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/pdf'
    });
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: SourceType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      onSourceSelected({
        sourceType: type,
        file,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div>
      <span className="eyebrow">LESSON SOURCE MATERIAL (SELECT ONE)</span>

      <div className="source-picker-grid">
        {/* Option A: In-browser Recorder */}
        <div
          className={`source-card ${activeTab === 'record' ? 'selected' : ''}`}
          onClick={() => handleTabSelect('record')}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span className="selection-radio" />
            <span className="eyebrow" style={{ margin: 0 }}>OPTION A</span>
          </div>
          <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Record Audio</h3>
          <p className="text-secondary" style={{ fontSize: '12px' }}>
            Live in-browser microphone capture (MediaRecorder API, Android Chrome tested).
          </p>
        </div>

        {/* Option B: Audio File Upload */}
        <div
          className={`source-card ${activeTab === 'upload_audio' ? 'selected' : ''}`}
          onClick={() => handleTabSelect('upload_audio')}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span className="selection-radio" />
            <span className="eyebrow" style={{ margin: 0 }}>OPTION B</span>
          </div>
          <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Upload Audio File</h3>
          <p className="text-secondary" style={{ fontSize: '12px' }}>
            Pre-recorded lecture (.mp3, .wav, .m4a, .aac, .ogg, .webm, .flac).
          </p>
        </div>

        {/* Option C: Document Upload */}
        <div
          className={`source-card ${activeTab === 'upload_doc' ? 'selected' : ''}`}
          onClick={() => handleTabSelect('upload_doc')}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span className="selection-radio" />
            <span className="eyebrow" style={{ margin: 0 }}>OPTION C</span>
          </div>
          <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Upload Document</h3>
          <p className="text-secondary" style={{ fontSize: '12px' }}>
            Curriculum slide decks or syllabus (.pdf, .ppt, .pptx, .docx).
          </p>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'record' && (
        <AudioRecorder
          onAudioReady={handleAudioRecorded}
          onReset={() => onSourceSelected(null)}
        />
      )}

      {activeTab === 'upload_audio' && (
        <div className="card card-solid">
          <span className="eyebrow">AUDIO FILE ATTACHMENT</span>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
            style={{ display: 'none' }}
            onChange={handleAudioFileChange}
          />

          {!uploadedFile ? (
            <div
              className={`dropzone-box ${dragActive ? 'drag-over' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, 'audio')}
              onClick={() => audioInputRef.current?.click()}
            >
              <span className="eyebrow">DRAG & DROP OR BROWSE</span>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Select an Audio File</h3>
              <p className="text-secondary" style={{ fontSize: '12px', marginBottom: '1rem' }}>
                Supports MP3, WAV, M4A, AAC, WEBM, FLAC (up to 200MB)
              </p>
              <button type="button" className="btn btn-secondary btn-sm">
                Choose Audio File
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex-between">
                <div>
                  <span className="eyebrow">SELECTED AUDIO ATTACHMENT</span>
                  <p style={{ fontWeight: 700, fontSize: '14px' }}>{uploadedFile.name}</p>
                  <p className="text-secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(uploadedFile.size)} • {uploadedFile.type || 'audio file'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => audioInputRef.current?.click()}
                >
                  Replace File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload_doc' && (
        <div className="card card-solid">
          <span className="eyebrow">DOCUMENT ATTACHMENT</span>

          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            style={{ display: 'none' }}
            onChange={handleDocFileChange}
          />

          {!uploadedFile ? (
            <div
              className={`dropzone-box ${dragActive ? 'drag-over' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, 'document')}
              onClick={() => docInputRef.current?.click()}
            >
              <span className="eyebrow">DRAG & DROP OR BROWSE</span>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Select a Slide Deck or Document</h3>
              <p className="text-secondary" style={{ fontSize: '12px', marginBottom: '1rem' }}>
                Supports PDF, PPT, PPTX, DOCX files (up to 50MB)
              </p>
              <button type="button" className="btn btn-secondary btn-sm">
                Choose Document File
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex-between">
                <div>
                  <span className="eyebrow">SELECTED DOCUMENT ATTACHMENT</span>
                  <p style={{ fontWeight: 700, fontSize: '14px' }}>{uploadedFile.name}</p>
                  <p className="text-secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(uploadedFile.size)} • {uploadedFile.type || 'document'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => docInputRef.current?.click()}
                >
                  Replace File
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
