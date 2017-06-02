package com.example.base;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Environment;
import android.text.TextUtils;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Created by sunxiaodong on 16/6/24.
 */
public class FileUtil {

    public static class Path {
        public static final String SDCARD = Environment.getExternalStorageDirectory().getPath();//SD卡

        public static final String SSZ = SDCARD + File.separator + "bundle_split_demo" + File.separator;//神算子老师端根目录

        public static final String BUNDLE_DIR = SSZ + "bundle" + File.separator;//bundle文件目录


        public static final String JS_BUNDLE_INFO_JSON_NAME = "info.json";
        public static final String JS_BUNDLE_INFO_JSON = BUNDLE_DIR + JS_BUNDLE_INFO_JSON_NAME;

        /**
         * 获取bundle路径
         * @param moduleName 模块名
         */
        public static String getBundlePath(String moduleName) {
            return BUNDLE_DIR + moduleName + File.separator + "index.bundle";
        }

    }

    /**
     * sd卡是否可用
     *
     * @return
     */
    public static boolean isSdValid() {
        if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
            return true;
        }
        return false;
    }

    /**
     * <br>功能简述:判断文件是否存在
     *
     * @param fileName 文件名
     * @return
     */
    public static boolean isFileExist(String fileName) {
        boolean ret = false;
        try {
            if (!TextUtils.isEmpty(fileName)) {
                File file = new File(fileName);
                ret = file.exists();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return ret;
    }

    /**
     * 创建文件夹
     *
     * @param filePath
     */
    public static void createFilePath(String filePath) {
        File destDir = new File(filePath);
        if (!destDir.exists()) {
            destDir.mkdirs();
        }
    }

    /**
     * <br>功能简述:创建文件
     *
     * @param fileName 文件名（包含路径）
     * @param replace  是否替换掉原有文件
     * @return 创建成功与否
     */
    public static boolean createFile(String fileName, boolean replace) {
        boolean ret = false;
        File newFile = new File(fileName);
        if (newFile.exists()) {
            if (replace) {
                if (fileName.endsWith(File.separator)) {
                    ret = true;
                } else {
                    if (newFile.delete()) {
                        //删除成功，再创建
                        try {
                            if (newFile.createNewFile()) {
                                ret = true;
                            }
                        } catch (IOException e) {
                            e.printStackTrace();
                        }
                    }
                }
            } else {
                ret = true;
            }
        } else {
            if (fileName.endsWith(File.separator)) {
                newFile.mkdirs();
            } else {
                File parent = newFile.getParentFile();
                if (parent != null && !parent.exists()) {
                    parent.mkdirs();
                }
            }
            try {
                if (!newFile.exists()) {
                    if (newFile.createNewFile()) {
                        ret = true;
                    }
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        newFile = null;
        return ret;
    }

    /**
     * <br>功能简述:删除文件
     *
     * @param imagePath
     */
    public static void deleteFile(String imagePath) {
        if (isFileExist(imagePath)) {
            File delFile = new File(imagePath);
            delFile.delete();
        }
    }

    /**
     * 清空文件夹
     */
    public static void clearFolder(String folderPath) {
        if (FileUtil.isFileExist(folderPath)) {
            File folder = new File(folderPath);
            if (folder.isDirectory()) {
                deleteFiles(folder);
                FileUtil.createFile(folderPath, true);
            }
        }
    }

    /**
     * 递归删除文件下所有文件
     *
     * @param filePath
     */
    public static void deleteFiles(String filePath) {
        if (TextUtils.isEmpty(filePath)) {
            return;
        }
        File file = new File(filePath);
        deleteFiles(file);
    }

    /**
     * 递归删除文件下所有文件
     *
     * @param file
     */
    public static void deleteFiles(File file) {
        if (file == null) {
            return;
        }
        if (file.exists()) {
            if (file.isFile()) {
                file.delete();
                return;
            }
            if (file.isDirectory()) {
                File[] childFiles = file.listFiles();
                if (childFiles != null && childFiles.length != 0) {
                    for (File f : childFiles) {
                        deleteFiles(f);
                    }
                }
                file.delete();
            }
        }
    }

    /**
     * 获取文件
     *
     * @param fileName
     * @return
     */
    public static File getFile(String fileName) {
        if (!isFileExist(fileName)) {
            return null;
        }
        File file = new File(fileName);
        return file;
    }

    /**
     * <br>功能简述:将图片写入文件
     *
     * @param fileName 文件名
     * @param replace  是否执行替换
     * @param bitmap   图片
     * @return
     */
    public static File saveBitmapToFile(String fileName, boolean replace, Bitmap bitmap) {
        OutputStream os = null;
        File file = null;
        try {
            if (createFile(fileName, replace)) {
                file = new File(fileName);
            }
            if (file == null) {
                return null;
            }
            os = new FileOutputStream(file);
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)) {
                file = null;
            }
            os.flush();
        } catch (Exception e) {
            e.printStackTrace();
            file = null;
        } finally {
            if (os != null) {
                try {
                    os.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }
        return file;
    }


    /**
     * <br>功能简述:从文件图片读到内存（并进行了防止爆内存处理）
     *
     * @param fileName 文件名
     * @return 图片
     */
    public static Bitmap readBitmapFromFile(String fileName) {
        Bitmap bitmap = null;
        if (!isFileExist(fileName)) {
            return bitmap;
        }
        File file = new File(fileName);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inJustDecodeBounds = false;
        boolean outMemory = false;
        try {
            bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), opts);
            outMemory = false;
        } catch (OutOfMemoryError e) {
            outMemory = true;
            e.printStackTrace();
        }
        //如果由于爆内存而加载失败, 尝试进一步减小加载的图片大小
        while (null == bitmap && outMemory) {
            opts.inSampleSize = opts.inSampleSize + 1;
            try {
                bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), opts);
                outMemory = false;
            } catch (OutOfMemoryError e) {
                outMemory = true;
                e.printStackTrace();
            }
        }
        return bitmap;
    }

    /**
     * <br>功能简述:保存图片带压缩
     *
     * @param fileName
     * @param replace
     * @param quality
     * @param bitmap
     * @return
     */
    public static boolean saveBitmapToFileWithCps(String fileName, boolean replace, int quality,
                                                  Bitmap bitmap) {
        boolean ret = false;
        OutputStream os = null;
        try {
            File file = null;
            if (createFile(fileName, replace)) {
                file = new File(fileName);
            }
            if (file == null) {
                return ret;
            }
            os = new FileOutputStream(file);
            if (bitmap.compress(Bitmap.CompressFormat.JPEG, quality, os)) {
                ret = true;
            }
            os.flush();
            file = null;
            ret = true;
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (os != null) {
                try {
                    os.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }
        return ret;
    }

    public static byte[] readFileToByteArray(String fileName) {
        if (!isFileExist(fileName)) {
            return null;
        }
        File file = new File(fileName);
        InputStream input = null;
        try {
            input = openInputStream(file);
            return toByteArray(input); // Do NOT use file.length() - see IO-453
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        } finally {
            closeQuietly(input);
        }
    }

    public static FileInputStream openInputStream(final File file) throws IOException {
        if (file.exists()) {
            if (file.isDirectory()) {
                throw new IOException("File '" + file + "' exists but is a directory");
            }
            if (file.canRead() == false) {
                throw new IOException("File '" + file + "' cannot be read");
            }
        } else {
            throw new FileNotFoundException("File '" + file + "' does not exist");
        }
        return new FileInputStream(file);
    }

    public static void closeQuietly(final Reader input) {
        closeQuietly((Closeable) input);
    }

    public static void closeQuietly(final Closeable closeable) {
        try {
            if (closeable != null) {
                closeable.close();
            }
        } catch (final IOException ioe) {
            // ignore
        }
    }

    public static byte[] toByteArray(final InputStream input) throws IOException {
        final ByteArrayOutputStream output = new ByteArrayOutputStream();
        copy(input, output);
        return output.toByteArray();
    }

    public static int copy(final InputStream input, final OutputStream output) throws IOException {
        final long count = copyLarge(input, output);
        if (count > Integer.MAX_VALUE) {
            return -1;
        }
        return (int) count;
    }

    private static final int DEFAULT_BUFFER_SIZE = 1024 * 4;

    public static long copyLarge(final InputStream input, final OutputStream output)
        throws IOException {
        return copy(input, output, DEFAULT_BUFFER_SIZE);
    }

    public static long copy(final InputStream input, final OutputStream output, final int bufferSize)
        throws IOException {
        return copyLarge(input, output, new byte[bufferSize]);
    }

    public static final int EOF = -1;

    public static long copyLarge(final InputStream input, final OutputStream output, final byte[] buffer)
        throws IOException {
        long count = 0;
        int n;
        while (EOF != (n = input.read(buffer))) {
            output.write(buffer, 0, n);
            count += n;
        }
        return count;
    }

    /**
     * 获取文件大小，单位M
     *
     * @param filePath
     */
    public static long getFileSizeM(String filePath) {
        return getFileSizeb(getFile(filePath)) / 1048576;
    }

    /**
     * 获取文件大小，单位bit
     *
     * @param file
     */
    public static long getFileSizeb(File file) {
        if (file == null) {
            return 0;
        }
        int size = 0;
        if (file.isDirectory()) {
            File[] fileArray = file.listFiles();
            if (fileArray != null) {
                for (int i = 0; i < fileArray.length; i++) {
                    File currentFile = fileArray[i];
                    size += getFileSizeb(currentFile);
                }
            }
        } else {
            size += file.length();
        }
        return size;
    }

    /**
     * 将文本文件中的内容读入到buffer中
     *
     * @param buffer   buffer
     * @param filePath 文件路径
     * @throws IOException 异常
     * @author cn.outofmemory
     * @date 2013-1-7
     */
    public static void readToBuffer(StringBuffer buffer, String filePath) throws IOException {
        InputStream is = new FileInputStream(filePath);
        String line; // 用来保存每行读取的内容
        BufferedReader reader = new BufferedReader(new InputStreamReader(is));
        line = reader.readLine(); // 读取第一行
        while (line != null) { // 如果 line 为空说明读完了
            buffer.append(line); // 将读到的内容添加到 buffer 中
            buffer.append("\n"); // 添加换行符
            line = reader.readLine(); // 读取下一行
        }
        reader.close();
        is.close();
    }

    /**
     * 读取文本文件内容
     *
     * @param filePath 文件所在路径
     * @return 文本内容
     * @throws IOException 异常
     * @author cn.outofmemory
     * @date 2013-1-7
     */
    public static String readFileToString(String filePath) {
        StringBuffer sb = new StringBuffer();
        try {
            readToBuffer(sb, filePath);
        } catch (IOException e) {

        }
        return sb == null ? "" : sb.toString();
    }

    private static File getRealFileName(String baseDir, String absFileName) {
        String[] dirs = absFileName.split("/");
        String lastDir = baseDir;
        if (dirs.length > 1) {
            for (int i = 0; i < dirs.length - 1; i++) {
                lastDir += (dirs[i] + "/");
                File dir = new File(lastDir);
                if (!dir.exists()) {
                    dir.mkdirs();
                    Log.d("getRealFileName", "create dir = " + (lastDir + "/" + dirs[i]));
                }
            }
            File ret = new File(lastDir, dirs[dirs.length - 1]);
            Log.d("upZipFile", "2ret = " + ret);
            return ret;
        } else {
            return new File(baseDir, absFileName);
        }
    }

    public static boolean upZipFile(String zipFilePath, String folderPath)  {
        boolean upZipSuccess = false;
        if (FileUtil.isFileExist(zipFilePath)) {
            try {
                upZipFile(new File(zipFilePath), folderPath);
                upZipSuccess = true;
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        return upZipSuccess;
    }

    /**
     * 解压缩功能.
     * 将zipFile文件解压到folderPath目录下.
     *
     * @throws Exception
     */
    public static int upZipFile(File zipFile, String folderPath) throws IOException {
        if (!FileUtil.isFileExist(folderPath)) {
            FileUtil.createFile(folderPath, true);
        }
        ZipFile zfile = new ZipFile(zipFile);
        Enumeration zList = zfile.entries();
        ZipEntry ze = null;
        byte[] buf = new byte[1024];
        while (zList.hasMoreElements()) {
            ze = (ZipEntry) zList.nextElement();
            if (ze.isDirectory()) {
                Log.d("upZipFile", "ze.getName() = " + ze.getName());
                String dirstr = folderPath + ze.getName();
                //dirstr.trim();
                dirstr = new String(dirstr.getBytes("8859_1"), "GB2312");
                Log.d("upZipFile", "str = " + dirstr);
                File f = new File(dirstr);
                f.mkdir();
                continue;
            }
            Log.d("upZipFile", "ze.getName() = " + ze.getName());
            OutputStream os = new BufferedOutputStream(new FileOutputStream(getRealFileName(folderPath, ze.getName())));
            InputStream is = new BufferedInputStream(zfile.getInputStream(ze));
            int readLen = 0;
            while ((readLen = is.read(buf, 0, 1024)) != -1) {
                os.write(buf, 0, readLen);
            }
            is.close();
            os.close();
        }
        zfile.close();
        Log.d("upZipFile", "finish");
        return 0;
    }

    /**
     * 获取Assets目录下读取文件
     */
    public static String getFileFromAssets(Context context, String fileName) {
        String result = "";
        try {
            InputStream is = context.getAssets().open(fileName);
            int size = is.available();
            byte[] buffer = new byte[size];
            is.read(buffer);
            is.close();
            result = new String(buffer, "UTF-8");
        } catch (IOException e) {
            e.printStackTrace();
        }
        return result;
    }

}
