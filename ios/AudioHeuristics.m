//
//  AudioHeuristics.m
//  rnaudioheuristics
//
//  Created by Prasuk Jain on 13/06/25.
//

#import "AudioHeuristics.h"
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioHeuristics, NSObject)


RCT_EXTERN_METHOD(measureAmbientNoise:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(removeBackgroundNoise:(NSString *)audioFileURL
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
