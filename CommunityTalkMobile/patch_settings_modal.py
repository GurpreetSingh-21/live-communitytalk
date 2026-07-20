import re

file_path = "/Users/gurpreetsingh/PROJECTS/communitytalkprod/CommunityTalkMobile/components/dating/SettingsModal.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. ADD CONSTANTS
constants = """
const LOVE_LANGUAGES = ['Words of Affirmation', 'Acts of Service', 'Receiving Gifts', 'Quality Time', 'Physical Touch'];
const PHYSICALLY_ACTIVE = ['Not active', 'Sometimes active', 'Moderately active', 'Very active', 'Fitness fanatic'];
const DRINKING_OPTIONS = ['No', 'Occasionally', 'Socially', 'Yes'];
const SMOKING_OPTIONS = ['No', 'Occasionally', 'Yes'];
const DIET_OPTIONS = ['Everything', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free'];
const RELIGION_OPTIONS = ['Agnostic', 'Atheist', 'Buddhist', 'Christian', 'Hindu', 'Jewish', 'Muslim', 'Sikh', 'Spiritual', 'Other', 'Prefer not to say'];
const LIVING_OPTIONS = ['Dorm / Residence Hall', 'Off-campus apartment', 'Commuter (live at home)', 'Greek house / Sorority/Fraternity'];
const STUDY_STYLES = ['Night owl 🦉', 'Early bird 🌅', 'Library person 📚', 'Café worker ☕', 'Wherever-I-can 🏃'];
const CAMPUS_ACTIVITIES_OPTIONS = [
    'Student Government', 'Sports Team', 'Debate Club', 'Music/Band', 'Theater/Drama',
    'Cultural Club', 'Pre-Med Society', 'Engineering Club', 'Business Club',
    'Greek Life', 'Volunteer/Community Service', 'Research', 'ROTC', 'Other',
];
const STUDY_YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad Student", "Alumni"];

function SelectRow({
    icon, label, value, options, onSelect
}: {
    icon: string; label: string; value: string; options: string[];
    onSelect: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <View style={{ marginBottom: 12 }}>
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}
                onPress={() => setOpen(!open)}
                activeOpacity={0.7}
            >
                <Ionicons name={icon as any} size={18} color="#FF6B6B" style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, fontSize: 16, color: '#0D0D0D' }}>{label}</Text>
                <Text style={{ fontSize: 15, color: value ? '#FF6B6B' : '#8A8A8E', marginRight: 6, fontWeight: value ? '600' : '400' }}>
                    {value || 'Select'}
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#8A8A8E" />
            </TouchableOpacity>
            {open && (
                <View style={{ backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4, overflow: 'hidden' }}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt}
                            style={[{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, value === opt && { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}
                            onPress={() => { onSelect(opt === value ? '' : opt); setOpen(false); }}
                        >
                            <Text style={{ fontSize: 15, color: value === opt ? '#FF6B6B' : '#0D0D0D', fontWeight: value === opt ? '600' : '400' }}>{opt}</Text>
                            {value === opt && <Ionicons name="checkmark" size={18} color="#FF6B6B" />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
"""
content = content.replace("const PRESET_PROMPTS = [", constants + "\nconst PRESET_PROMPTS = [")


# 2. ADD STATE
state_vars = """
    const [headline, setHeadline] = useState('');
    const [height, setHeight] = useState('');
    const [livingArrangement, setLivingArrangement] = useState('');
    const [campusActivities, setCampusActivities] = useState<string[]>([]);
    const [studyStyle, setStudyStyle] = useState('');
    const [lookingFor, setLookingFor] = useState('');
    const [loveLanguage, setLoveLanguage] = useState('');
    const [physicallyActive, setPhysicallyActive] = useState('');
    const [drinking, setDrinking] = useState('');
    const [smoking, setSmoking] = useState('');
    const [diet, setDiet] = useState('');
    const [religion, setReligion] = useState('');
    const [hometown, setHometown] = useState('');
    const [instagramHandle, setInstagramHandle] = useState('');
    // Editable Fields"""
content = content.replace("    // Editable Fields", state_vars)


# 3. UPDATE LOAD
load_profile = """
            setPhotos(data.photos || []);
            setBio(data.bio || '');
            setHeadline(data.headline || '');
            setHeight(data.height?.toString() || '');
            setLivingArrangement(data.livingArrangement || '');
            setCampusActivities(data.campusActivities || []);
            setStudyStyle(data.studyStyle || '');
            setLookingFor(data.lookingFor || '');
            setLoveLanguage(data.loveLanguage || '');
            setPhysicallyActive(data.physicallyActive || '');
            setDrinking(data.drinking || '');
            setSmoking(data.smoking || '');
            setDiet(data.diet || '');
            setReligion(data.religion || '');
            setHometown(data.hometown || '');
            setInstagramHandle(data.instagramHandle || '');
            setMajor(data.major || '');"""
content = content.replace("            setPhotos(data.photos || []);\n            setBio(data.bio || '');\n            setMajor(data.major || '');", load_profile)


# 4. UPDATE SAVE
save_profile = """
                bio,
                headline,
                height,
                livingArrangement,
                campusActivities,
                studyStyle,
                lookingFor,
                loveLanguage,
                physicallyActive,
                drinking,
                smoking,
                diet,
                religion,
                hometown,
                instagramHandle,
                major,"""
content = content.replace("                bio,\n                major,", save_profile)

# 5. UI Updates
ui_about_me = """<Text style={styles.sectionTitle}>About Me</Text>
                    <View style={styles.glassCard}>
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.label}>Headline</Text>
                            <TextInput
                                style={[styles.basicInput, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', fontWeight: '500' }]}
                                value={headline}
                                onChangeText={setHeadline}
                                placeholder="A catchy headline..."
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <TextInput
                            style={styles.bioInput}
                            multiline
                            maxLength={500}
                            value={bio}"""
content = content.replace("<Text style={styles.sectionTitle}>About Me</Text>\n                    <View style={styles.glassCard}>\n                        <TextInput\n                            style={styles.bioInput}\n                            multiline\n                            maxLength={500}\n                            value={bio}", ui_about_me)

ui_basics = """
                    <Text style={styles.sectionTitle}>The Basics</Text>
                    <View style={styles.glassCard}>
                        <View style={styles.inputRow}>
                            <Ionicons name="book-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={major}
                                onChangeText={setMajor}
                                placeholder="Major (e.g. Computer Science)"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="school-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={gradYear}
                                onChangeText={setGradYear}
                                placeholder="Class of 2026"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="body-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={height}
                                onChangeText={setHeight}
                                placeholder="Height (cm)"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="home-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={hometown}
                                onChangeText={setHometown}
                                placeholder="Hometown"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="logo-instagram" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={instagramHandle}
                                onChangeText={setInstagramHandle}
                                placeholder="Instagram handle (without @)"
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
"""
content = content.replace("""                    <Text style={styles.sectionTitle}>The Basics</Text>
                    <View style={styles.glassCard}>
                        <View style={styles.inputRow}>
                            <Ionicons name="book-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={major}
                                onChangeText={setMajor}
                                placeholder="Major (e.g. Computer Science)"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="school-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={gradYear}
                                onChangeText={setGradYear}
                                placeholder="Class of 2026"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="home-outline" size={20} color="#8A8A8E" />
                            <TextInput
                                style={styles.basicInput}
                                value={greekLife}
                                onChangeText={setGreekLife}
                                placeholder="Greek Life / Dorm (Optional)"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>""", ui_basics)


ui_lifestyle = """
                    <Text style={styles.sectionTitle}>Lifestyle & Campus</Text>
                    <View style={{ paddingBottom: 10 }}>
                        <SelectRow icon="home" label="Living Arrangement" value={livingArrangement} options={LIVING_OPTIONS} onSelect={setLivingArrangement} />
                        <SelectRow icon="book" label="Study Style" value={studyStyle} options={STUDY_STYLES} onSelect={setStudyStyle} />
                        <SelectRow icon="heart" label="Love Language" value={loveLanguage} options={LOVE_LANGUAGES} onSelect={setLoveLanguage} />
                        <SelectRow icon="search" label="Looking For" value={lookingFor} options={['Relationship', 'Casual Dating', 'Friends First', 'Not Sure Yet']} onSelect={setLookingFor} />
                        <SelectRow icon="barbell" label="Physically Active" value={physicallyActive} options={PHYSICALLY_ACTIVE} onSelect={setPhysicallyActive} />
                        <SelectRow icon="wine" label="Drinking" value={drinking} options={DRINKING_OPTIONS} onSelect={setDrinking} />
                        <SelectRow icon="flame" label="Smoking" value={smoking} options={SMOKING_OPTIONS} onSelect={setSmoking} />
                        <SelectRow icon="restaurant" label="Diet" value={diet} options={DIET_OPTIONS} onSelect={setDiet} />
                        <SelectRow icon="moon" label="Religion" value={religion} options={RELIGION_OPTIONS} onSelect={setReligion} />
                    </View>

                    <Text style={styles.sectionTitle}>My Interests</Text>"""
content = content.replace("<Text style={styles.sectionTitle}>My Interests</Text>", ui_lifestyle)

with open(file_path, "w") as f:
    f.write(content)
print("Updated successfully")
