# Putting Tafra on Google Play (PLAY-1)

Play is for the friends' pilot first: friends install from a Play test link and get updates by themselves. GitHub APKs keep working beside it.

- [`listing.md`](listing.md): store text, category and graphics.
- [`declarations.md`](declarations.md): what to answer on each App content page.
- [`../../PRIVACY.md`](../../PRIVACY.md): the privacy policy Play links to.

## What the repo already does

- **Target SDK 36, min SDK 26.** Play needs 35+ for new apps, so nothing to change.
- **A Play bundle on every release tag.** Pushing `vX.Y.Z` builds `tafra-X.Y.Z.aab` next to the APK, signs it with the release key in the `release` environment (after your approval, like the APK), checks its certificate against `FITNESS_OS_CERT_SHA256`, and saves it as the run's **tafra-play-bundle-X.Y.Z** artifact. It isn't attached to the GitHub release.
- **Every PR checks that the bundle still builds** (unsigned), so a break shows up before a tag.
- **Permissions Play would question are gone.** No `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- **A copy from Play stays with Play.** Settings > About > Check for updates and Share Tafra point to the Play page when Play installed the app, and to GitHub otherwise. (Play doesn't allow an app it installed to send people elsewhere for updates.)

## Steps only you can do

### 1. Make a developer account (once, about 2 days)

1. Go to [play.google.com/console/signup](https://play.google.com/console/signup) with the Google account you want to own the app.
2. Pick **Yourself** (personal account). Pay the one-time **US$25** fee.
3. Verify your identity (ID document) and your phone, and install the **Play Console** app on your A55 when asked: personal accounts must show they have an Android device.
4. The contact email you give is shown on the store page. Use one you're happy to show.

### 2. Create the app

Play Console > **Create app**: name `Tafra: Workout & Meal Plan`, default language English (United States), **App**, **Free**, tick the declarations.

Free can't be changed to paid later. That matches the "stay free until after the pilot" decision; a paid version would need to be a new app.

### 3. Fill in App content and the store listing

Copy from [`declarations.md`](declarations.md) and [`listing.md`](listing.md). Upload the icon, feature graphic and screenshots from the project folder `play-store/`. For the foreground service declaration, record the short rest-timer video it describes.

### 4. Choose the signing key BEFORE the first upload

This choice can't be undone. Pick the option that keeps your existing key, so the Play app and the GitHub APKs are the same app to Android: updates install over each other and nobody loses data.

1. Release > Setup > **App signing** (or the prompt on your first release) > **Choose signing key** > **Use a different key** > **Export and upload a key from Java keystore** (Play renames these now and then; pick the one that uploads your own keystore).
2. Download **pepk.jar** and the **encryption public key** from that page.
3. On a computer, with your saved copy of `fitness-os.jks` (from the Make signing key run):

   ```
   java -jar pepk.jar --keystore=fitness-os.jks --alias=fitnessos \
     --output=encrypted-private-key.zip --include-cert \
     --rsa-aes-encryption --encryption-key-path=encryption_public_key.pem
   ```

   It asks for the keystore password. The zip it writes is encrypted for Google only.
4. Upload `encrypted-private-key.zip`. **Skip** "upload a separate upload key": the bundles CI signs use the same key.

If Play makes a new key for you instead, the Play app can't update a GitHub install (and the reverse): each friend would have to back up, uninstall, install from Play, and import.

### 5. Upload the first bundle

1. Tag a release as usual (`vX.Y.Z` on main) and approve the `release` environment.
2. When the run is green, open it in Actions and download **tafra-play-bundle-X.Y.Z** (unzip once to get the `.aab`).
3. Play Console > Test and release > Testing > **Internal testing** > Create new release > upload the `.aab` > add the What's new text > Save > Review > Roll out.
4. Testers tab: make an email list with friends' Gmail addresses, copy the **join link**, and send it. They tap it, accept, and install from Play.

Internal testing has no review wait and holds up to 100 testers: good for the pilot.

### 6. Going public later (new personal accounts)

Google requires a **closed test with at least 12 testers who stay opted in for 14 days in a row** before a new personal account can apply for production. When you're ready:

1. Testing > **Closed testing** > create a track, add 12+ friends, roll out the same bundle.
2. Keep them in for 14 days and ship a fix or two (Google looks for real testing).
3. Dashboard > **Apply for production** and answer the questions about the test.

Each later release: tag, approve, download the bundle, upload it to the track. The version code comes from the tag, so it always goes up.

## Before the first upload, check on your phone

- Settings > reminders check > Battery **Fix** opens Tafra's Android settings page (tap Battery > Unrestricted).
- Settings > About > Check for updates still opens GitHub on the GitHub APK.
