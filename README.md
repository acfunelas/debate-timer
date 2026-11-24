# Debate Timer

A lightweight React and Bootstrap timer for Modified Oxford and Asian Parliamentary debates.

## Run locally

```sh
npm install
npm start
```

Choose a debate format and set shared durations for speaker time, reply speeches, Points of Information, and grace time. The grace period applies to speaker and reply timers, not POI timers. Select a speaker, then start the clock. The timer dings at one minute elapsed (when the timer is longer than one minute), dings again at the end of the configured time, and double-dings when the grace period ends. Pause to change timings, reset the active timer, or move to the next speaker. The settings dialog includes a button to preview the bell sound.

The app opens with Asian Parliamentary selected. Both formats default to five-minute speeches, three-minute replies, a 30-second grace period, and 15-second POIs. Modified Oxford has four alternating speeches and two reply speeches; Asian Parliamentary has six speeches followed by Opposition Reply and Government Reply, with POIs accepted during the first four speeches from 1:00 elapsed until 1:00 remains. Selecting POI starts a separate countdown progress bar using the configured POI duration while the speech timer continues running.
