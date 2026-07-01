# Initial Event Design and Validation

## Blink-Off

Acceptance criteria: calibrates before play, consumes shared blink primitives, ends on blink, scores open-eye duration, and applies Bronze/Silver/Gold thresholds.

## Face Weightlifting

Acceptance criteria: calibrates before play, consumes eyebrow and blink primitives, raises a silly barbell with eyebrow input, accumulates hold time at the top, and scores medals from event-owned thresholds.

## Dragon Blast

Acceptance criteria: calibrates before play, consumes mouth-open and pursed-lip primitives, charges while mouth is open, releases on lip purse or mouth-close fallback, counts target hits, and scores medals from event-owned thresholds.

## Validation Plan

Automated tests cover pure event scoring/state transitions. Manual verification remains required on real mobile browsers for camera permission, MediaPipe performance, threshold tuning, and kid-readable facial feedback.
