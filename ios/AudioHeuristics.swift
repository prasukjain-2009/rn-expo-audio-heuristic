//
//  AudioHeuristics.swift
//  rnaudioheuristics
//
//  Created by Prasuk Jain on 13/06/25.
//

import Foundation
import AVFoundation
import React

@objc(AudioHeuristics)
class AudioHeuristics: NSObject {
    private var audioRecorder: AVAudioRecorder?
    private var audioEngine: AVAudioEngine?
    private var audioFile: AVAudioFile?
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc
    func measureAmbientNoise(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        let audioSession = AVAudioSession.sharedInstance()
        
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default)
            try audioSession.setActive(true)
            
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: 44100.0,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]
            
            let tempDir = FileManager.default.temporaryDirectory
            let tempFile = tempDir.appendingPathComponent("temp_recording.wav")
            
            audioRecorder = try AVAudioRecorder(url: tempFile, settings: settings)
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.prepareToRecord()
            audioRecorder?.record()
            
            // Sample for 3 seconds
            var samples: [Float] = []
            let startTime = Date()
            
            while Date().timeIntervalSince(startTime) < 3.0 {
                audioRecorder?.updateMeters()
                if let decibels = audioRecorder?.averagePower(forChannel: 0) {
                    samples.append(decibels)
                }
                Thread.sleep(forTimeInterval: 0.1)
            }
            
            audioRecorder?.stop()
            
            // Calculate average decibels
            let averageDB = samples.reduce(0, +) / Float(samples.count)
            
            // Determine noise level category
            let noiseLevel: String
            if averageDB < -50 {
                noiseLevel = "🟢 Quiet"
            } else if averageDB < -30 {
                noiseLevel = "🟠 Moderate"
            } else {
                noiseLevel = "🔴 Loud"
            }
            
            resolve([
                "dB": averageDB,
                "noiseLevel": noiseLevel
            ] as [String: Any])
            
        } catch {
            reject("ERROR", "Failed to measure ambient noise", error)
        }
    }
    
    @objc
    func removeBackgroundNoise(_ audioFileURL: String,
                             resolver resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        do {
            let url = URL(string: audioFileURL)!
            let audioFile = try AVAudioFile(forReading: url)
            let audioEngine = AVAudioEngine()
            let player = AVAudioPlayerNode()
            let eq = AVAudioUnitEQ(numberOfBands: 10)
            
            // Configure EQ for noise reduction
            for i in 0..<10 {
                let band = eq.bands[i]
                band.frequency = Float(20 * pow(2.0, Double(i)))
                band.bandwidth = 1.0
                band.bypass = false
                band.gain = -10.0 // Reduce gain to minimize noise
            }
            
            audioEngine.attach(player)
            audioEngine.attach(eq)
            
            audioEngine.connect(player, to: eq, format: audioFile.processingFormat)
            audioEngine.connect(eq, to: audioEngine.mainMixerNode, format: audioFile.processingFormat)
            
            let outputPath = (audioFileURL as NSString).deletingPathExtension + "_cleaned.wav"
            let outputURL = URL(fileURLWithPath: outputPath)
            
            let outputFile = try AVAudioFile(forWriting: outputURL,
                                           settings: audioFile.processingFormat.settings)
            
            player.scheduleFile(audioFile, at: nil)
            try audioEngine.start()
            player.play()
            
            // Process the audio
            let buffer = AVAudioPCMBuffer(pcmFormat: audioFile.processingFormat,
                                        frameCapacity: AVAudioFrameCount(audioFile.length))
            
            while audioEngine.isRunning {
                try outputFile.write(from: buffer!)
            }
            
            audioEngine.stop()
            resolve(outputPath)
            
        } catch {
            reject("ERROR", "Failed to remove background noise", error)
        }
    }
}
