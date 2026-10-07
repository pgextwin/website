# pgextwin website

[æ—¥æœ¬èª](README_ja.md) | English

Static Website v2 for discovering pgextwin Windows x64 PostgreSQL extension binaries. The site remains vanilla HTML/CSS/JavaScript with no frontend framework or build step.

## Data sources and responsibilities

The browser combines two independent canonical sources at runtime:

- `pgextwin/catalog` schema v2: release identity, binary availability, canonical direct-download URLs, ZIP SHA-256 values, runtime requirements, Test Contract-derived capabilities, immutable capability provenance, and release-specific supply-chain evidence availability.
- `pgextwin/build/metadata/postgresql.json`: PostgreSQL community lifecycle/EOL dates used to derive the current maintenance state.

`available` and `maintained` are deliberately different. Existing binaries remain downloadable as historical artifacts after PostgreSQL EOL. The EOL date itself is maintained; historical status begins on the following UTC calendar day. If lifecycle metadata cannot be fetched, catalog discovery/downloads continue and only lifecycle status falls back to `Lifecycle unknown`.

## Website v2 UX

Website v2 provides:

- case-insensitive search across extension name, display name, description, and upstream repository,
- a PostgreSQL-major filter dynamically derived from currently available catalog records,
- AND-combined search + PostgreSQL filtering, result counts, and an explicit empty state,
- canonical direct ZIP links from `postgresql.<major>.downloadUrl`,
- the complete 64-character ZIP SHA-256 synchronized by Catalog CI with the published `SHA256SUMS.txt`,
- user-facing `runtime.requirements` including CREATE EXTENSION, preload semantics, background-worker use, and required client executables/package paths,
- functional scenarios and CI coverage from Test Contract v2, including PostgreSQL-major-specific scenario scoping,
- immutable `capabilitiesSource` links pinned to the exact extension-repository commit,
- per-major build provenance / SPDX SBOM / SBOM attestation / vulnerability-report availability,
- direct SPDX SBOM and point-in-time Grype-report links when those release assets exist.

Attestations are shown as attestations, not fictional Release assets. `not-covered` CI coverage is never presented as unsupported. Vulnerability reports are point-in-time evidence and the Website does not generate security verdicts.

The current initial-eight Releases predate the Step 6â€“10-enabled release path. Their evidence fields are therefore displayed neutrally as additional evidence not published for that historical Release. This does not imply that the current build infrastructure lacks those capabilities.

## Failure handling and URL safety

An index fetch/schema failure is a catalog-level error. Individual extension-record fetch or defensive-validation failures do not‰±…¹¬Ñ¡”•¹Ñ¥É”…Ñ…±½œìÙ…±¥É•½É‘ÌÍÑ¥±°É•¹‘•È…¹Ñ¡”ÍÑ…ÑÕÌÉ•Á½ÉÑÌÑ¡”Õ¹…Ù…¥±…‰±”µÉ•½É½Õ¹Ğ¸1¥™•å±”™•Ñ ™…¥±ÕÉ•Ì…É”¥Í½±…Ñ•¥¸Ñ¡”Í…µ”İ…ä¸()…Ñ…±½œØÈ¥Ì™Õ±±äÙ…±¥‘…Ñ•¥¸…Ñ…±½œ$¸Q¡”]•‰Í¥Ñ”Á•É™½ÉµÌ½¹±ä±¥¡Ñİ•¥¡Ğ‘•™•¹Í¥Ù”¡•­Ì°É•ÅÕ¥É•ÌÍ¡•µ„ØÈ™½ÈÑ¡”¥¹‘•à½É•½É‘Ì°…¹½¹±äÑÕÉ¹Ì¡ÑÑÁÌé€UI1Ì¥¹Ñ¼±¥¹­Ì¸…Ñ…±½œÙ…±Õ•Ì…É”¥¹Í•ÉÑ•İ¥Ñ =4A%Ì€¼Ñ•áÑ½¹Ñ•¹Ñ€°¹½Ğ¥¹¹•É!Q51€¸((ŒŒ•ÍÍ¥‰¥±¥Ñä()Q¡”™¥±Ñ•È½¹ÑÉ½±Ì¡…Ù”•áÁ±¥¥Ğ±…‰•±Ì°ÍÑ…ÑÕÌ½É•ÍÕ±Ğ½Õ¹ÑÌÕÍ”Á½±¥Ñ”±¥Ù”É•¥½¹Ì°±¥™•å±”½•Ù¥‘•¹”½½Ù•É…”ÍÑ…Ñ•Ì¥¹±Õ‘”Ñ•áĞÉ…Ñ¡•ÈÑ¡…¸É•±å¥¹œ½¸½±½È°…¹¹…Ñ¥Ù”€ñ‘•Ñ…¥±Ìù€½€ñÍÕµµ…Éäù€½¹ÑÉ½±Ì­••À‘•¹Í”¥¹™½Éµ…Ñ¥½¸­•å‰½…Éµ½Á•É…‰±”¸M!´ÈÔØÙ…±Õ•ÌÉ•µ…¥¸Ù¥Í¥‰±”…¹İÉ…ÀÉ…Ñ¡•ÈÑ¡…¸‰•¥¹œÑÉÕ¹…Ñ•¸1…å½ÕÑÌÉ•™±½Ü™½È¹…ÉÉ½ÜÍÉ••¹Ì…¹€ÈÀÀ”é½½´İ¥Ñ¡½ÕĞ¡¥‘¥¹œÑ¡”ÁÉ¥µ…ÉäÍ•…É °™¥±Ñ•È°‘½İ¹±½…°¡•­ÍÕ´°½ÈÁÉ½©•Ğµ±¥¹¬…Ñ¥½¹Ì¸Y¥Í¥‰±”™½ÕÌÍÑå±•Ì…É”ÁÉ½Ù¥‘•™½È±¥¹­Ì°½¹ÑÉ½±Ì°…¹ÍÕµµ…É¥•Ì¸((ŒŒ1½…°ÁÉ•Ù¥•Ü()M•ÉÙ”Ñ¡¥Ì‘¥É•Ñ½Éäİ¥Ñ …¹äÍÑ…Ñ¥Œ!QQ@Í•ÉÙ•È¸=Á•¹¥¹œ¥¹‘•à¹¡Ñµ±€‘¥É•Ñ±äµ…ä‰”É•ÍÑÉ¥Ñ•‰ä‰É½İÍ•È™•Ñ Á½±¥¥•Ì¸((ŒŒQ•ÍÑÌ()AÕÉ”…Ñ…±½œµÙ¥•Ü±½¥Œ¥Ì¥Í½±…Ñ•¥¸…Ñ…±½œµÙ¥•Ü¹©Í€ìA½ÍÑÉ•ME0±¥™•å±”±½¥ŒÉ•µ…¥¹Ì¥¸±¥™•å±”¹©Í€¸	½Ñ ÕÍ”½¹±ä9½‘”ÌÍÑ…¹‘…ÉÑ•ÍĞÉÕ¹¹•Èè()Ñ•áĞ)¹½‘”€´µÑ•ÍĞÑ•ÍÑÌ¼¨¹Ñ•ÍĞ¹©Ì)€()Q•ÍÑÌ½Ù•ÈÍ•…É °‘å¹…µ¥Œµ…©½È‘•É¥Ù…Ñ¥½¸½™¥±Ñ•É¥¹œ°½µ‰¥¹•™¥±Ñ•ÉÌ°ÉÕ¹Ñ¥µ”İ½É‘¥¹œ°‰…­É½Õ¹µİ½É­•È½±¥•¹Ğµ•á•ÕÑ…‰±”ÁÉ•Í•¹Ñ…Ñ¥½¸°A½ÍÑÉ•ME0µµ…©½ÈµÍÁ•¥™¥ŒÍ•¹…É¥½Ì°$½Ù•É…”İ½É‘¥¹œ°¡¥ÍÑ½É¥…°½™ÕÑÕÉ”•Ù¥‘•¹”™¥áÑÕÉ•Ì°UI0Í…™•Ñä°Í¡•µ„É•©•Ñ¥½¸°Á…ÉÑ¥…°É•½É™…¥±ÕÉ•Ì°…¹Ñ¡”•á¥ÍÑ¥¹œA½ÍÑÉ•ME0€ÄĞ=0½™…±±‰…¬±¥™•å±”½¹ÑÉ…Ğ¸((ŒŒ$…¹‘•Á±½åµ•¹Ğ()€¹¥Ñ¡Õˆ½İ½É­™±½İÌ½Ù…±¥‘…Ñ”¹åµ±€ÉÕ¹Ì¹½‘”€´µ¡•­€™½ÈÑ¡”)…Ù…MÉ¥ÁĞ•¹ÑÉäÁ½¥¹ÑÌ…¹¹½‘”€´µÑ•ÍĞÑ•ÍÑÌ¼¨¹Ñ•ÍĞ¹©Í€™½ÈÁÕ±°É•ÅÕ•ÍÑÌ…¹ÁÕÍ¡•ÌÑ¼µ…¥¹€¸¥Ñ!ÕˆÑ¥½¹Ì­••À½¹Ñ•¹ÑÌèÉ•…‘€…¹ÕÍ”™Õ±°µM!µÁ¥¹¹•½™™¥¥…°…Ñ¥½¹Ì¸¥Ñ!ÕˆA…•Ì‘•Á±½åÌÑ¡”ÍÑ…Ñ¥Œµ…¥¹€‰É…¹ ¥¹‘•Á•¹‘•¹Ñ±ä½˜Ñ¡•Í”ÉÕ¹Ñ¥µ”‘…Ñ„Í½ÕÉ•Ì¸(