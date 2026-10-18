package org.food4all.pilot;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.RectF;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.print.pdf.PrintedPdfDocument;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.FileOutputStream;

/** Prints only a locally generated PNG; accepts no URLs or executable HTML. */
@CapacitorPlugin(name = "FoodPrint")
public class FoodPrintPlugin extends Plugin {
    @PluginMethod public void printLabel(PluginCall call) {
        String image = call.getString("image", "");
        if (!image.startsWith("data:image/png;base64,") || image.length() > 12000000) {
            call.reject("A valid label PNG is required."); return;
        }
        final Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(image.substring(22), Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) throw new IllegalArgumentException("Invalid PNG");
        } catch (Exception e) { call.reject("Could not read label image."); return; }
        getActivity().runOnUiThread(() -> {
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            manager.print("Food4All India batch label", new PrintDocumentAdapter() {
                private PrintAttributes attributes;
                @Override public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs,
                        CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
                    attributes = newAttrs;
                    if (signal.isCanceled()) { callback.onLayoutCancelled(); return; }
                    callback.onLayoutFinished(new PrintDocumentInfo.Builder("Food4All India-label.pdf")
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(1).build(), true);
                }
                @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                        CancellationSignal signal, WriteResultCallback callback) {
                    if (signal.isCanceled()) { callback.onWriteCancelled(); return; }
                    boolean requested = false;
                    for (PageRange range : pages) if (range.getStart() <= 0 && range.getEnd() >= 0) requested = true;
                    if (!requested) { callback.onWriteFinished(new PageRange[0]); return; }
                    PrintedPdfDocument document = new PrintedPdfDocument(getContext(), attributes);
                    try (FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                        android.graphics.pdf.PdfDocument.Page page = document.startPage(0);
                        Canvas canvas = page.getCanvas();
                        android.graphics.Rect content = page.getInfo().getContentRect();
                        float scale = Math.min((float)content.width()/bitmap.getWidth(), (float)content.height()/bitmap.getHeight());
                        float w = bitmap.getWidth()*scale, h = bitmap.getHeight()*scale;
                        canvas.drawBitmap(bitmap, null, new RectF(content.left+(content.width()-w)/2,
                            content.top, content.left+(content.width()+w)/2, content.top+h), null);
                        document.finishPage(page);
                        if (signal.isCanceled()) { callback.onWriteCancelled(); return; }
                        document.writeTo(output);
                        callback.onWriteFinished(new PageRange[]{new PageRange(0,0)});
                    } catch (Exception e) { callback.onWriteFailed("Could not print label."); }
                    finally { document.close(); }
                }
                @Override public void onFinish() { bitmap.recycle(); }
            }, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build());
            call.resolve();
        });
    }
}
