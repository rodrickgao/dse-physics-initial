param(
    [Parameter(Mandatory = $true)]
    [string]$InputJson,

    [Parameter(Mandatory = $true)]
    [string]$OutputJson
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
}

function Await-WinRt {
    param(
        [Parameter(Mandatory = $true)]$Operation,
        [Parameter(Mandatory = $true)][Type]$ResultType
    )

    $method = $asTaskMethods | Where-Object {
        $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
    } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

$language = [Windows.Globalization.Language]::new("en-US")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) {
    throw "No compatible Windows OCR language is installed."
}

$paths = Get-Content -LiteralPath $InputJson -Raw | ConvertFrom-Json
$results = [System.Collections.Generic.List[object]]::new()
$processed = 0

foreach ($path in $paths) {
    $fullPath = [IO.Path]::GetFullPath([string]$path)
    $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
        $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $recognition = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
            $lines = foreach ($line in $recognition.Lines) {
                $words = foreach ($word in $line.Words) {
                    [ordered]@{
                        text = $word.Text
                        left = [math]::Round($word.BoundingRect.X, 2)
                        top = [math]::Round($word.BoundingRect.Y, 2)
                        width = [math]::Round($word.BoundingRect.Width, 2)
                        height = [math]::Round($word.BoundingRect.Height, 2)
                    }
                }
                [ordered]@{
                    text = $line.Text
                    words = @($words)
                }
            }
            $results.Add([ordered]@{
                path = $fullPath
                width = $bitmap.PixelWidth
                height = $bitmap.PixelHeight
                lines = @($lines)
            })
        }
        finally {
            if ($bitmap -is [IDisposable]) {
                $bitmap.Dispose()
            }
        }
    }
    finally {
        $stream.Dispose()
    }

    $processed += 1
    if (($processed % 25) -eq 0) {
        Write-Host "Processed $processed / $($paths.Count) images"
    }
}

$json = $results | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputJson), $json, [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($results.Count) OCR layouts to $OutputJson"
