// SnakeYAML の「量の制限」の既定を測る。
//
// PyYAML と js-yaml は alias の展開に既定の上限を持たない。SnakeYAML だけが
// 既定で 2 つの上限（コレクションの alias 数・入力の code point 数）を持つ。
// ここでは 60 連の alias を 1 段だけ置いた入力で、既定と明示設定の応答を測る。
//
// 🔴 爆発はさせない。入力は 1 段の alias 60 連であり、指数展開は起こさない。
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Enumeration;
import java.util.jar.Manifest;

public class Measure {

  /** 実行時 API から版が取れないため、jar のマニフェストから読む。 */
  static String bundleVersion() {
    try {
      Enumeration<URL> res = Measure.class.getClassLoader().getResources("META-INF/MANIFEST.MF");
      while (res.hasMoreElements()) {
        try (InputStream in = res.nextElement().openStream()) {
          Manifest mf = new Manifest(in);
          String name = mf.getMainAttributes().getValue("Bundle-SymbolicName");
          if ("org.yaml.snakeyaml".equals(name)) {
            return mf.getMainAttributes().getValue("Bundle-Version");
          }
        }
      }
    } catch (IOException ignored) {
      // 読めなければ不明として返す
    }
    return "unknown";
  }

  /** 読み込めたら型名、拒まれたら例外クラス名を返す。文言では判定しない。 */
  static String probe(Yaml y, String doc) {
    try {
      Object o = y.load(doc);
      return o == null ? "null" : o.getClass().getSimpleName();
    } catch (Throwable t) {
      return t.getClass().getSimpleName();
    }
  }

  static String json(String s) {
    return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
  }

  public static void main(String[] args) throws Exception {
    Path here = Path.of(args[0]);
    String doc = Files.readString(here.resolve("fixtures/aliases60.yaml"));
    String version = bundleVersion();
    // マニフェストの 2.7.0 は Maven 座標の 2.7 と同じもの。座標側の表記に揃える。
    String coord = version.endsWith(".0") ? version.substring(0, version.length() - 2) : version;

    LoaderOptions defaults = new LoaderOptions();
    int maxAliases = defaults.getMaxAliasesForCollections();
    int codePointLimit = defaults.getCodePointLimit();

    String atDefault = probe(new Yaml(), doc);

    LoaderOptions up = new LoaderOptions();
    up.setMaxAliasesForCollections(100);
    String at100 = probe(new Yaml(new SafeConstructor(up)), doc);

    LoaderOptions down = new LoaderOptions();
    down.setMaxAliasesForCollections(10);
    String at10 = probe(new Yaml(new SafeConstructor(down)), doc);

    String globalTag = probe(new Yaml(), "!!java.io.File [/tmp/x]");

    String sha1 = args.length > 1 ? args[1] : "unknown";

    String out = String.join("\n",
        "{",
        "  \"scenario\": \"010-jvm-limits\",",
        "  \"measuredAt\": " + json(Instant.now().toString()) + ",",
        "  \"platform\": " + json(System.getProperty("os.name")) + ",",
        "  \"toolVersions\": " + json("SnakeYAML " + coord) + ",",
        "  \"jdkVersion\": " + json(System.getProperty("java.version")) + ",",
        "  \"jarSha1\": " + json(sha1) + ",",
        "  \"bundleVersion\": " + json(version) + ",",
        "  \"implementationVersionFromApi\": "
            + json(String.valueOf(Yaml.class.getPackage().getImplementationVersion())) + ",",
        "  \"defaultMaxAliasesForCollections\": " + json(String.valueOf(maxAliases)) + ",",
        "  \"defaultCodePointLimit\": " + json(String.valueOf(codePointLimit)) + ",",
        "  \"aliases60Default\": " + json(atDefault) + ",",
        "  \"aliases60Max100\": " + json(at100) + ",",
        "  \"aliases60Max10\": " + json(at10) + ",",
        "  \"globalTagDefault\": " + json(globalTag),
        "}",
        "");
    Path res = here.resolve("results/summary.json");
    Files.createDirectories(res.getParent());
    Files.writeString(res, out);

    System.out.println("SnakeYAML " + coord + "（jar sha1 " + sha1 + "）");
    System.out.println("  既定 maxAliasesForCollections = " + maxAliases + " / codePointLimit = " + codePointLimit);
    System.out.println("  alias 60 連: 既定 = " + atDefault + " / max=100 = " + at100 + " / max=10 = " + at10);
    System.out.println("  グローバルタグ（既定）= " + globalTag);
  }
}
