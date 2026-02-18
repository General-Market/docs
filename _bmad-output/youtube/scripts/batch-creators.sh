#!/bin/bash
# Batch scrape shorts for all 84 creators from top-200 list
# Skips already-completed channels. Stops on rate limit.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../channels/creators"
SCRIPT="$SCRIPT_DIR/scrape-shorts.py"
PROGRESS_FILE="$OUT_DIR/.progress"

mkdir -p "$OUT_DIR"
touch "$PROGRESS_FILE"

# Check if channel already done
is_done() {
    local slug="$1"
    # Check in creators dir
    if [ -f "$OUT_DIR/${slug}-shorts.md" ]; then
        local lines=$(wc -l < "$OUT_DIR/${slug}-shorts.md" 2>/dev/null)
        if [ "$lines" -gt 5 ]; then
            return 0
        fi
    fi
    # Check in general dir
    if [ -f "$SCRIPT_DIR/../channels/general/${slug}-shorts.md" ]; then
        return 0
    fi
    # Check in finance dir
    if [ -f "$SCRIPT_DIR/../channels/finance/${slug}-shorts.md" ]; then
        return 0
    fi
    return 1
}

scrape() {
    local handle="$1"
    local name="$2"
    local slug="$3"

    if is_done "$slug"; then
        echo "SKIP: $name ($slug) - already done"
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "SCRAPING: $name (@$handle) -> $slug"
    echo "=========================================="

    local tmplog="$OUT_DIR/.${slug}.log"
    PYTHONUNBUFFERED=1 python3 "$SCRIPT" "$handle" "$name" "$OUT_DIR/${slug}-shorts.md" 50 2>&1 | tee "$tmplog"
    exit_code=${PIPESTATUS[0]}

    # Check for rate limiting signals
    if grep -qi "429\|rate.limit\|too.many.request\|IP.block\|IpBlocked" "$tmplog" 2>/dev/null; then
        echo ""
        echo "!!! RATE LIMITED at $name !!!"
        echo "RATE_LIMITED_AT=$slug" >> "$PROGRESS_FILE"
        rm -f "$tmplog"
        return 1
    fi

    rm -f "$tmplog"
    echo "DONE: $slug" >> "$PROGRESS_FILE"
    # Small pause between channels
    sleep 3
    return 0
}

echo "Starting batch scrape at $(date)"
echo "Output: $OUT_DIR"
echo ""

# === STORYTELLING CREATORS ===
scrape "mrbeast" "MrBeast" "mrbeast" || exit 1
scrape "daniellabelle" "Daniel LaBelle" "daniel-labelle" || exit 1
scrape "alanchikinchow" "Alan Chikin Chow" "alan-chikin-chow" || exit 1
scrape "zachking" "Zach King" "zach-king" || exit 1
scrape "dafuqboom" "DaFuq Boom" "dafuq-boom" || exit 1
scrape "dharmann" "Dhar Mann" "dhar-mann" || exit 1
scrape "zhong" "Zhong" "zhong" || exit 1
scrape "jakefellman" "Jake Fellman" "jake-fellman" || exit 1
scrape "jasonderulo" "Jason Derulo" "jason-derulo" || exit 1
scrape "danrhodes" "Dan Rhodes" "dan-rhodes" || exit 1
scrape "stokestwins" "Stokes Twins" "stokes-twins" || exit 1
scrape "mattrife" "Matt Rife" "matt-rife" || exit 1
scrape "brentrivera" "Brent Rivera" "brent-rivera" || exit 1
scrape "kevinhart4real" "Kevin Hart" "kevin-hart" || exit 1
scrape "willsmith" "Will Smith" "will-smith" || exit 1
scrape "doubledate" "Double Date" "double-date" || exit 1
scrape "cadelandmia" "Cadel and Mia" "cadel-and-mia" || exit 1
scrape "smosh" "Smosh" "smosh" || exit 1
scrape "nasdaily" "Nas Daily" "nas-daily" || exit 1
scrape "adamw" "Adam W" "adam-w" || exit 1
scrape "lelepons" "Lele Pons" "lele-pons" || exit 1
scrape "daviddobrik" "David Dobrik" "david-dobrik" || exit 1
scrape "zackdfilms" "Zack D. Films" "zackdfilms" || exit 1
scrape "gilmhercroes" "Gilmher Croes" "gilmher-croes" || exit 1
scrape "hannahstocking" "Hannah Stocking" "hannah-stocking" || exit 1
scrape "anwarjibawi" "Anwar Jibawi" "anwar-jibawi" || exit 1
scrape "amandacerny" "Amanda Cerny" "amanda-cerny" || exit 1
scrape "druskiog" "Druski" "druski" || exit 1
scrape "jidion" "JiDion" "jidion" || exit 1
scrape "rdcworld1" "RDCWorld" "rdcworld" || exit 1
scrape "calebcity" "CalebCity" "calebcity" || exit 1
scrape "oversimplified" "Oversimplified" "oversimplified" || exit 1
scrape "lizakoshy" "Liza Koshy" "liza-koshy" || exit 1
scrape "theovon" "Theo Von" "theo-von" || exit 1
scrape "brookemonk" "Brooke Monk" "brooke-monk" || exit 1
scrape "jakeshane" "Jake Shane" "jake-shane" || exit 1
scrape "narasmith" "Nara Smith" "nara-smith" || exit 1
scrape "devonrodriguez" "Devon Rodriguez" "devon-rodriguez" || exit 1
scrape "baileysarian" "Bailey Sarian" "bailey-sarian" || exit 1
scrape "erikakullberg" "Erika Kullberg" "erika-kullberg" || exit 1
scrape "ryantrahan" "Ryan Trahan" "ryan-trahan" || exit 1
scrape "rosscreations" "Ross Creations" "ross-creations" || exit 1
scrape "tabithabrown" "Tabitha Brown" "tabitha-brown" || exit 1
scrape "legaleagle" "Legal Eagle" "legal-eagle" || exit 1
scrape "ameliadimoldenberg" "Amelia Dimoldenberg" "amelia-dimoldenberg" || exit 1
scrape "keithlee" "Keith Lee" "keith-lee" || exit 1
scrape "rickeythompson" "Rickey Thompson" "rickey-thompson" || exit 1
scrape "madelineargy" "Madeline Argy" "madeline-argy" || exit 1
scrape "beingbernz" "Hannah Berner" "hannah-berner" || exit 1
scrape "delaneyrowe" "Delaney Rowe" "delaney-rowe" || exit 1
scrape "loicsuberville" "Loic Suberville" "loic-suberville" || exit 1
scrape "fibula" "Connor Wood" "connor-wood" || exit 1
scrape "jordanhowlett" "Jordan Howlett" "jordan-howlett" || exit 1
scrape "michellekhare" "Michelle Khare" "michelle-khare" || exit 1
scrape "bennydrama7" "Benny Drama" "benny-drama" || exit 1
scrape "itsdanielmac" "Daniel Mac" "daniel-mac" || exit 1
scrape "nikocadoavocado" "Nikocado Avocado" "nikocado-avocado" || exit 1

# === EDUCATIONAL / TUTORIAL ===
scrape "markrober" "Mark Rober" "mark-rober" || exit 1
scrape "5minutecraftsYT" "5-Minute Crafts" "5-minute-crafts" || exit 1
scrape "austinsprinz" "AustinSprinz" "austinsprinz" || exit 1
scrape "brightsideofficial" "Bright Side" "bright-side" || exit 1
scrape "theinfographicsshow" "The Infographics Show" "the-infographics-show" || exit 1
scrape "dailydoseofinternet" "Daily Dose of Internet" "daily-dose-of-internet" || exit 1
scrape "lawbymike" "Law by Mike" "law-by-mike" || exit 1
scrape "doctormike" "Doctor Mike" "doctor-mike" || exit 1
scrape "kurzgesagt" "Kurzgesagt" "kurzgesagt" || exit 1
scrape "veritasium" "Veritasium" "veritasium" || exit 1
scrape "chloeting" "Chloe Ting" "chloe-ting" || exit 1
scrape "jeffnippard" "Jeff Nippard" "jeff-nippard" || exit 1
scrape "aliabdaal" "Ali Abdaal" "ali-abdaal" || exit 1
scrape "haborscience" "Hank Green" "hank-green" || exit 1
scrape "thomasfrank" "Thomas Frank" "thomas-frank" || exit 1
scrape "alexisnikole" "Alexis Nikole Nelson" "alexis-nikole" || exit 1

# === FINANCE ===
scrape "calebhammer" "Caleb Hammer" "caleb-hammer" || exit 1
scrape "marktilbury" "Mark Tilbury" "mark-tilbury" || exit 1
scrape "colinandsamir" "Colin and Samir" "colin-and-samir" || exit 1

# === MOTIVATIONAL / BUSINESS ===
scrape "garyvee" "GaryVee" "garyvee" || exit 1
scrape "alexhormozi" "Alex Hormozi" "alex-hormozi" || exit 1
scrape "melrobbins" "Mel Robbins" "mel-robbins" || exit 1
scrape "jayshetty" "Jay Shetty" "jay-shetty" || exit 1
scrape "yourrichbff" "Vivian Tu" "vivian-tu" || exit 1
scrape "alexcooper" "Alex Cooper" "alex-cooper" || exit 1
scrape "stevenbartlett" "Steven Bartlett" "steven-bartlett" || exit 1

echo ""
echo "=========================================="
echo "BATCH COMPLETE at $(date)"
echo "=========================================="
