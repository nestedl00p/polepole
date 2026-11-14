namespace SwahiliCourse.Api.Services;

// Where kept pronunciation takes live on disk.
//
// Files rather than database rows: a few hundred kilobytes of audio per take
// would bloat the SQLite file that every other query reads. They sit beside it
// — under DataDir when that is set, so they survive a container restart for
// the same reason the database does — one folder per learner.
public class VoiceStore
{
    // A spoken word or short phrase. Anything larger is not a take of a card.
    public const long MaxBytes = 2_000_000;

    // Per card: the first take is kept for good, because "your first attempt"
    // is the comparison the feature exists for, plus this many of the latest.
    public const int RecentPerItem = 4;

    // Extensions by content type. Also the allow-list: a type not here is
    // refused, and the extension is never taken from the client's file name.
    private static readonly Dictionary<string, string> Extensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["audio/webm"] = ".webm",
        ["audio/ogg"] = ".ogg",
        ["audio/mp4"] = ".m4a",
        ["audio/m4a"] = ".m4a",
        ["audio/x-m4a"] = ".m4a",
        ["audio/aac"] = ".aac",
        ["audio/mpeg"] = ".mp3",
        ["audio/wav"] = ".wav",
        ["audio/x-wav"] = ".wav",
        ["audio/3gpp"] = ".3gp",
    };

    private readonly string _root;

    public VoiceStore(IConfiguration config, IWebHostEnvironment env)
    {
        var dataDir = config["DataDir"];
        _root = string.IsNullOrWhiteSpace(dataDir)
            ? Path.Combine(env.ContentRootPath, "App_Data", "voice")
            : Path.Combine(dataDir, "voice");
    }

    // "audio/webm;codecs=opus" → "audio/webm".
    public static string BaseType(string? contentType) =>
        (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();

    public static string? ExtensionFor(string? contentType) =>
        Extensions.TryGetValue(BaseType(contentType), out var ext) ? ext : null;

    private string FolderFor(int userId) => Path.Combine(_root, userId.ToString());

    public string PathFor(int userId, string fileName) =>
        // GetFileName drops any directory part, so a stored name can never
        // walk out of the learner's own folder.
        Path.Combine(FolderFor(userId), Path.GetFileName(fileName));

    public async Task<(string FileName, long Size)> SaveAsync(
        int userId, Stream audio, string extension, CancellationToken ct)
    {
        Directory.CreateDirectory(FolderFor(userId));
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var path = PathFor(userId, fileName);

        await using (var file = File.Create(path))
            await audio.CopyToAsync(file, ct);

        return (fileName, new FileInfo(path).Length);
    }

    // Every take a learner kept — for deleting the account they belong to.
    public void DeleteAll(int userId)
    {
        var folder = FolderFor(userId);
        if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
    }

    // Files and bytes on disk across all learners, for the backoffice.
    public (int Files, long Bytes) Usage()
    {
        if (!Directory.Exists(_root)) return (0, 0);
        var files = new DirectoryInfo(_root).GetFiles("*", SearchOption.AllDirectories);
        return (files.Length, files.Sum(f => f.Length));
    }

    public void Delete(int userId, string fileName)
    {
        var path = PathFor(userId, fileName);
        if (File.Exists(path)) File.Delete(path);
    }
}
