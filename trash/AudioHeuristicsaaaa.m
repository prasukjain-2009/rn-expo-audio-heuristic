#import "AudioHeuristics.h"
#import <React/RCTBridgeModule.h>

@interface AudioHeuristics : NSObject <RCTBridgeModule>
@end

@implementation AudioHeuristics

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(measureAmbientNoise:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Implementation for measureAmbientNoise
}

RCT_EXPORT_METHOD(removeBackgroundNoise:(NSString *)audioFileURL
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Implementation for removeBackgroundNoise
}

@end 