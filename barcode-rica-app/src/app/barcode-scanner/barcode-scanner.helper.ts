export interface IScoredDevice {
    device: MediaDeviceInfo
    score: number
}

export class BarcodeScannerHelper {
    public static scoreDeviceLabel(label: string): number {
        const l = label.toLowerCase();
        let score = 0;
    
        if (/back|rear|environment/.test(l)) score += 10;
        if (/front|user|selfie|facetime|truedepth/.test(l)) score -= 20;
        if (/ultra|ultrawide|0\.5x/.test(l)) score -= 8;
        if (/telephoto|2x|3x|5x/.test(l)) score -= 8;
        if (/depth|dual|mono/.test(l)) score -= 3
        return score;
    }

    public static async selectBestAvailableDevice(availableDevices: MediaDeviceInfo[]) {
        if (availableDevices.length <= 1) return null;

        const scoredDevices: IScoredDevice[] = availableDevices.map((d: MediaDeviceInfo) => ({
            device: d,
            score: this.scoreDeviceLabel(d.label)
        }))
        const bestByLabel: IScoredDevice = scoredDevices.reduce((a, b) => (b.score > a.score ? b : a));
        if (bestByLabel.score > 0) {
            return bestByLabel.device;
        }

        const nonFrontFacingCamera = scoredDevices.filter((s) => s.score >= 0);
        const fallbackCandidates = nonFrontFacingCamera.length ? nonFrontFacingCamera : scoredDevices;
      
        for (const { device } of fallbackCandidates) {
          const facing: 'environment' | 'user' | undefined = await this.probeDeviceFacingMode(device.deviceId);
          if (facing === 'environment') return device;
          if (facing === 'user') continue;
        }

        return availableDevices[0]
    }

    public static async probeDeviceFacingMode(
      deviceId: string
    ): Promise<'environment' | 'user' | undefined> {
        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId }, width: 1, height: 1 },
            });
            const facing = stream
                .getVideoTracks()[0]
                ?.getSettings()
                .facingMode as 'environment' | 'user' | undefined;
            return facing;
        } catch {
            return undefined;
        } finally {
            stream?.getVideoTracks().forEach((track) => track.stop());
        }
    }

}